import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface CircuitBreakerConfig {
  maxWeightPerMinute: number;
  latencyThresholdMs: number;
  maxConsecutiveErrors: number;
  cooldownPeriodMs: number;
  maxSlippagePercent: number;
}

export class CircuitBreaker extends EventEmitter {
  private usedWeight: number = 0;
  private currentLatency: number = 0;
  private consecutiveErrors: number = 0;
  private isTripped: boolean = false;
  private trippedSymbols: Map<string, NodeJS.Timeout> = new Map();
  private tripTimeout: NodeJS.Timeout | null = null;
  private lastRequestTime: number = 0;

  constructor(private config: CircuitBreakerConfig = {
    maxWeightPerMinute: 6000, 
    latencyThresholdMs: 2000,
    maxConsecutiveErrors: 5,
    cooldownPeriodMs: 60000, // 1 minute cooldown
    maxSlippagePercent: 1.0 // 1% max slippage
  }) {
    super();
    // Decay used weight every minute
    setInterval(() => {
      this.usedWeight = 0;
      if (this.consecutiveErrors > 0 && !this.isTripped) {
         this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      }
    }, 60000);
  }

  public trackRequest(latencyMs: number, weight: number = 1, status: number = 200, totalUsedWeight?: number) {
    this.currentLatency = latencyMs;
    if (totalUsedWeight !== undefined) {
      this.usedWeight = Math.max(this.usedWeight, totalUsedWeight);
    } else {
      this.usedWeight += weight;
    }
    this.lastRequestTime = Date.now();

    if (status >= 400 && status !== 401 && status !== 403 && status !== 404) {
      // Don't count auth errors or not found as network errors, only rate limits or server errors
      if (status === 429 || status === 418 || status >= 500) {
          this.consecutiveErrors++;
      }
    } else {
      this.consecutiveErrors = 0;
    }

    this.checkThresholds();
  }

  public trackSlippage(symbol: string, expectedPrice: number, actualFillPrice: number) {
    if (expectedPrice <= 0 || actualFillPrice <= 0) return;
    const slippageStr = Math.abs((actualFillPrice - expectedPrice) / expectedPrice * 100);
    if (slippageStr > this.config.maxSlippagePercent) {
      this.tripSymbol(symbol, `Slippage spike detected: ${slippageStr.toFixed(2)}% (Expected: ${expectedPrice}, Actual: ${actualFillPrice})`);
    }
  }

  private checkThresholds() {
    if (this.isTripped) return;

    let reason = '';
    if (this.usedWeight >= this.config.maxWeightPerMinute) {
      reason = `Rate limit weight exceeded (${this.usedWeight}/${this.config.maxWeightPerMinute})`;
    } else if (this.currentLatency >= this.config.latencyThresholdMs) {
      reason = `Latency threshold exceeded (${this.currentLatency}ms/${this.config.latencyThresholdMs}ms)`;
    } else if (this.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      reason = `Too many consecutive errors (${this.consecutiveErrors})`;
    }

    if (reason) {
      this.trip(reason);
    }
  }

  private tripSymbol(symbol: string, reason: string) {
    console.warn(`[Circuit Breaker] TRIPPED for ${symbol}: ${reason}. Halting trading for ${this.config.cooldownPeriodMs / 1000}s.`);
    this.emit('tripped_symbol', { symbol, reason });
    if (this.trippedSymbols.has(symbol)) {
      clearTimeout(this.trippedSymbols.get(symbol)!);
    }
    const timeout = setTimeout(() => {
      this.trippedSymbols.delete(symbol);
      console.log(`[Circuit Breaker] RESET for ${symbol}. Resuming normal operations.`);
      this.emit('reset_symbol', symbol);
    }, this.config.cooldownPeriodMs);
    this.trippedSymbols.set(symbol, timeout);
  }

  private trip(reason: string) {
    this.isTripped = true;
    this.emit('tripped', reason);
    console.warn(`[Circuit Breaker] TRIPPED GLOBALLY: ${reason}. Halting trading for ${this.config.cooldownPeriodMs / 1000}s.`);
    
    if (this.tripTimeout) clearTimeout(this.tripTimeout);
    this.tripTimeout = setTimeout(() => this.reset(), this.config.cooldownPeriodMs);
  }

  public reset() {
    this.isTripped = false;
    this.consecutiveErrors = 0;
    this.usedWeight = 0;
    this.trippedSymbols.forEach(timeout => clearTimeout(timeout));
    this.trippedSymbols.clear();
    this.emit('reset');
    console.log(`[Circuit Breaker] RESET GLOBALLY. Resuming normal operations.`);
  }

  public canTrade(symbol?: string): boolean {
    if (this.isTripped) return false;
    if (symbol && this.trippedSymbols.has(symbol)) return false;
    return true;
  }
}

export const globalCircuitBreaker = new CircuitBreaker();

// Utility to wrap Axios requests with Circuit Breaker tracking
export async function withCircuitBreaker(
  requestFn: () => Promise<any>,
  weight: number = 1,
  symbol?: string
) {
  if (!globalCircuitBreaker.canTrade(symbol)) {
    throw new Error(`Circuit Breaker is tripped${symbol ? ` for ${symbol}` : ''}. Order rejected to protect API keys and account.`);
  }

  const startTime = Date.now();
  try {
    const response = await requestFn();
    const duration = Date.now() - startTime;
    
    // Check headers for weight
    let totalUsedWeight: number | undefined;
    if (response.headers && response.headers['x-mbx-used-weight-1m']) {
       totalUsedWeight = parseInt(response.headers['x-mbx-used-weight-1m'], 10);
    }
    
    globalCircuitBreaker.trackRequest(duration, weight, response.status, totalUsedWeight);
    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    let status = 500;
    if (error.response) {
      status = error.response.status;
      let totalUsedWeight: number | undefined;
      if (error.response.headers && error.response.headers['x-mbx-used-weight-1m']) {
         totalUsedWeight = parseInt(error.response.headers['x-mbx-used-weight-1m'], 10);
      }
      globalCircuitBreaker.trackRequest(duration, weight, status, totalUsedWeight);
    } else {
       // Network error
      globalCircuitBreaker.trackRequest(duration, weight, 503); 
    }
    throw error;
  }
}
