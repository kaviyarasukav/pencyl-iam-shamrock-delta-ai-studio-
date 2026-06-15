import Big from 'big.js';
import { formatQuantity } from '../lib/precision';

/**
 * RISK_SAFETY_MARGIN: 0.5% (0.005)
 * We subtract this from the calculated risk amount to account for:
 * 1. Delta Exchange Trading Fees (usually 0.1%)
 * 2. Potential Slippage on entry
 * 3. Balance fluctuations
 */
const RISK_SAFETY_MARGIN = 0.005; 

export class RiskManager {
  /**
   * Calculates the exact quantity to BUY based on a percentage of free quote balance (e.g., USDT).
   * Accounts for fees and prevents "insufficient funds" errors by applying a safety buffer.
   */
  static calculateBuyQty(
    freeQuoteBalance: string | number,
    riskPercentage: number, // 0 to 100 (from the Signal weight)
    currentPrice: string | number,
    stepSize: string | number
  ): string {
    const balance = new Big(freeQuoteBalance);
    const riskPct = new Big(riskPercentage).div(100);
    const price = new Big(currentPrice);
    
    // If price is 0 (error case), prevent division by zero
    if (price.eq(0)) return '0';

    // Determine the max spendable amount after safety margin
    // spendable = balance * (1 - RISK_SAFETY_MARGIN)
    const spendableBalance = balance.times(new Big(1).sub(RISK_SAFETY_MARGIN));
    
    // riskAmount = spendableBalance * riskPct
    const riskAmount = spendableBalance.times(riskPct);
    
    // rawQty = riskAmount / price
    const rawQty = riskAmount.div(price);
    
    // Pass through Phase 1.1 Precision Engine (which rounds DOWN)
    return formatQuantity(rawQty.toString(), stepSize);
  }

  /**
   * Calculates the exact quantity to SELL based on a percentage of free base balance (e.g., BTC).
   */
  static calculateSellQty(
    freeBaseBalance: string | number,
    riskPercentage: number, // 0 to 100
    stepSize: string | number
  ): string {
    const balance = new Big(freeBaseBalance);
    const riskPct = new Big(riskPercentage).div(100);
    
    // For selling, we usually want to be as close to 100% as possible if requested,
    // but we leave a tiny 0.01% "dust" buffer to ensure the order doesn't fail 
    // if a tiny fraction is locked in a previous pending trade.
    const sellSafety = 0.0001; 
    const effectiveBalance = riskPercentage >= 100 ? balance.times(1 - sellSafety) : balance;
    
    const rawQty = effectiveBalance.times(riskPct);
    
    // Pass through Phase 1.1 Precision Engine (rounds DOWN)
    return formatQuantity(rawQty.toString(), stepSize);
  }
}
