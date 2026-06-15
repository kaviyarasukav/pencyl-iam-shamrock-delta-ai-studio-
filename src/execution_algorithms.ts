import { broker, TOPICS } from '../broker';
import { formatQuantity, formatPrice } from './lib/precision';
import { getCachedData } from '../server/cache';
import { saveAlgoState, deleteAlgoState, getAllAlgoStates } from './db/sqlite_journal';

export interface AlgoExecutionParams {
  internal_order_id: string;
  timestamp?: number;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: number;
  totalQuantity: number;
  market?: string;
  price?: number;
  metadata?: any;
  isShadow?: boolean;
}

export interface TWAPParams extends AlgoExecutionParams {
  algo: 'TWAP';
  durationMs: number;
  sliceCount: number;
}

export interface VWAPParams extends AlgoExecutionParams {
  algo: 'VWAP';
  durationMs: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TickChaserParams extends AlgoExecutionParams {
  algo: 'PEG_BBO';
  maxRetries?: number;
  durationMs?: number;
}

export class ExecutionAlgorithms {
  private activeAlgos: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    try {
      const states = getAllAlgoStates() as any[];
      if (states && states.length > 0) {
        console.log(`[OMS Algo] Rehydrating ${states.length} active algos...`);
        for (const state of states) {
          const parsedParams = state.state ? JSON.parse(state.state) : {};
          if (state.algo_type === 'TWAP') {
            this.startTWAP({
              ...parsedParams,
              internal_order_id: state.internal_order_id,
              symbol: state.symbol,
              side: state.side,
              totalQuantity: state.total_quantity,
              durationMs: state.duration_ms,
              sliceCount: state.slice_count
            }, state.executed_slices);
          } else if (state.algo_type === 'VWAP') {
            this.startVWAP({
              ...parsedParams,
              internal_order_id: state.internal_order_id,
              symbol: state.symbol,
              side: state.side,
              totalQuantity: state.total_quantity,
              durationMs: state.duration_ms,
              urgency: state.urgency
            }, state.remaining_quantity, state.executed_slices);
          }
        }
      }
    } catch (e) {
      console.error("[OMS Algo] Failed to hydrate states", e);
    }
  }

  // Basic TWAP execution
  public async startTWAP(params: TWAPParams, startingSlice = 0) {
    console.log(`[OMS Algo] Starting TWAP for ${params.symbol} - Total: ${params.totalQuantity}, Slices: ${params.sliceCount}, Duration: ${params.durationMs}ms`);
    
    let timer: NodeJS.Timeout | null = null;
    let executedSlices = startingSlice;
    const totalQty = typeof params.totalQuantity === 'string' ? parseFloat(params.totalQuantity) : params.totalQuantity;
    const sliceQty = totalQty / params.sliceCount;
    // Time remaining based on how many slices are left
    const remainingSlices = params.sliceCount - executedSlices;
    if (remainingSlices <= 0) {
      deleteAlgoState.run(params.internal_order_id);
      return;
    }
    const intervalMs = params.durationMs / params.sliceCount;

    const executeSlice = () => {
      executedSlices++;
      const currentOrderId = `${params.internal_order_id}-twap-${executedSlices}`;
      
      const exchangeInfo = getCachedData('exchangeInfo', 86400000) as any;
      let formattedSliceQty = sliceQty.toString();
      if (exchangeInfo && exchangeInfo.symbols) {
        const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === params.symbol);
        if (symbolInfo) {
          const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
          const stepSize = lotSizeFilter?.stepSize || '0.00000001';
          formattedSliceQty = formatQuantity(sliceQty, stepSize);
        }
      }

      // Snapshot exact state to SQLite BEFORE making the order to prevent state loss
      try {
        saveAlgoState.run({
          internal_order_id: params.internal_order_id,
          algo_type: 'TWAP',
          symbol: params.symbol,
          side: params.side,
          total_quantity: Number(params.totalQuantity),
          remaining_quantity: totalQty - (sliceQty * executedSlices),
          slice_count: params.sliceCount,
          executed_slices: executedSlices,
          duration_ms: params.durationMs,
          urgency: 'LOW',
          last_update: Date.now(),
          state: JSON.stringify(params)
        });
      } catch(e) {
        console.error("[OMS Algo] Failed to save TWAP state", e);
      }

      // Instead of an immediate execution, optionally route through tick-chaser if it's mid-market
      const orderPayload = {
        ...params,
        internal_order_id: currentOrderId,
        quantity: formattedSliceQty,
        timestamp: params.timestamp || Date.now()
      } as any;
      delete (orderPayload).algo;
      
      console.log(`[OMS Algo] TWAP ${params.symbol} slice ${executedSlices}/${params.sliceCount} (${sliceQty})`);
      broker.publish(TOPICS.EXECUTE_ORDER, orderPayload);

      if (executedSlices >= params.sliceCount) {
        if (timer) clearInterval(timer);
        this.activeAlgos.delete(params.internal_order_id);
        deleteAlgoState.run(params.internal_order_id);
        console.log(`[OMS Algo] TWAP ${params.symbol} finished.`);
      }
    };

    if (startingSlice === 0) {
        executeSlice();
    }
    
    if (executedSlices < params.sliceCount) {
      timer = setInterval(executeSlice, intervalMs);
      this.activeAlgos.set(params.internal_order_id, timer);
    }
  }

  // VWAP Execution
  public async startVWAP(params: VWAPParams, remainingOverride?: number, executedSlicesOverride = 0) {
    console.log(`[OMS Algo] Starting VWAP for ${params.symbol} - Total: ${params.totalQuantity}, Urgency: ${params.urgency}, Duration: ${params.durationMs}ms`);
    
    const sliceCount = params.urgency === 'HIGH' ? 5 : (params.urgency === 'MEDIUM' ? 10 : 20);
    const intervalMs = params.durationMs / sliceCount;
    let timer: NodeJS.Timeout | null = null;
    let executedSlices = executedSlicesOverride;
    let remainingQty = remainingOverride !== undefined ? remainingOverride : (typeof params.totalQuantity === 'string' ? parseFloat(params.totalQuantity) : params.totalQuantity);

    if (remainingQty <= 0) {
      deleteAlgoState.run(params.internal_order_id);
      return;
    }

    const executeSlice = () => {
      executedSlices++;
      const currentOrderId = `${params.internal_order_id}-vwap-${executedSlices}`;
      
      let sliceQty = remainingQty / (sliceCount - executedSlices + 1); 
      if (params.urgency === 'HIGH' && executedSlices < sliceCount / 2) {
          sliceQty *= 1.5; 
      }
      sliceQty = Math.min(sliceQty, remainingQty);
      remainingQty -= sliceQty;

      const exchangeInfo = getCachedData('exchangeInfo', 86400000) as any;
      let formattedSliceQty = sliceQty.toString();
      if (exchangeInfo && exchangeInfo.symbols) {
        const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === params.symbol);
        if (symbolInfo) {
          const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
          const stepSize = lotSizeFilter?.stepSize || '0.00000001';
          formattedSliceQty = formatQuantity(sliceQty, stepSize);
        }
      }

      // Snapshot to SQLite BEFORE dispatching
      try {
        saveAlgoState.run({
          internal_order_id: params.internal_order_id,
          algo_type: 'VWAP',
          symbol: params.symbol,
          side: params.side,
          total_quantity: Number(params.totalQuantity),
          remaining_quantity: remainingQty,
          slice_count: sliceCount,
          executed_slices: executedSlices,
          duration_ms: params.durationMs,
          urgency: params.urgency,
          last_update: Date.now(),
          state: JSON.stringify(params)
        });
      } catch(e) {
        console.error("[OMS Algo] Failed to save VWAP state", e);
      }

      const orderPayload = {
        ...params,
        internal_order_id: currentOrderId,
        quantity: formattedSliceQty,
        timestamp: params.timestamp || Date.now()
      } as any;
      delete (orderPayload).algo;
      
      console.log(`[OMS Algo] VWAP ${params.symbol} slice ${executedSlices}/${sliceCount} (${sliceQty})`);
      broker.publish(TOPICS.EXECUTE_ORDER, orderPayload);

      if (executedSlices >= sliceCount || remainingQty <= 0) {
        if (timer) clearInterval(timer);
        this.activeAlgos.delete(params.internal_order_id);
        deleteAlgoState.run(params.internal_order_id);
        console.log(`[OMS Algo] VWAP ${params.symbol} finished.`);
      }
    };

    if (executedSlicesOverride === 0) {
        executeSlice();
    }
    
    if (executedSlices < sliceCount && remainingQty > 0) {
      timer = setInterval(executeSlice, intervalMs);
      this.activeAlgos.set(params.internal_order_id, timer);
    }
  }

  // Best Bid/Offer Pegging (Tick Chaser)
  public async startTickChaser(params: TickChaserParams) {
    console.log(`[OMS Algo] Starting BBO Tick Chaser for ${params.symbol}`);
    const maxRetries = params.maxRetries || 20;
    const intervalMs = params.durationMs ? Math.max(300, params.durationMs / maxRetries) : 500;
    let retries = 0;
    
    let currentOrderId: string | null = null;
    let currentTargetPrice: number | null = null;
    let isFilled = false;
    let isCanceling = false;

    // Listen for fill updates across all replaced orders
    const onExec = (report: any) => {
      if (!report.internal_order_id?.startsWith(`${params.internal_order_id}-peg-`)) return;
      
      if (report.status === 'FILLED') {
        console.log(`[OMS Algo] Tick chaser filled for ${params.symbol}!`);
        isFilled = true;
        this.cancelAlgo(params.internal_order_id);
        broker.unsubscribe(TOPICS.EXECUTION_REPORT, onExec);
      }
    };
    broker.subscribe(TOPICS.EXECUTION_REPORT, onExec);

    const tryPeg = async () => {
      if (isFilled) return;

      const depth = getCachedData(`depth_${params.symbol}`, 2000) as any;
      let newTargetPrice: number | null = null;
      
      if (depth && depth.bids && depth.asks && depth.bids.length > 0 && depth.asks.length > 0) {
        newTargetPrice = params.side === 'BUY' ? parseFloat(depth.bids[0][0]) : parseFloat(depth.asks[0][0]);
      } else {
        const ticker = getCachedData('ticker', 2000) as any[];
        const t = ticker?.find(x => x.symbol === params.symbol);
        newTargetPrice = params.side === 'BUY' ? parseFloat(t?.bidPrice || params.price || '0') : parseFloat(t?.askPrice || params.price || '0');
      }

      if (!newTargetPrice) {
         console.warn(`[OMS Algo] Could not get BBO for ${params.symbol}. Skipping tick.`);
         return;
      }

      // If price hasn't moved, do nothing
      if (currentTargetPrice === newTargetPrice && currentOrderId) {
        return;
      }

      if (isCanceling) return; // Prevent overlapping replacements
      
      const exchangeInfo = getCachedData('exchangeInfo', 86400000) as any;
      let tickSize = '0.01';
      if (exchangeInfo && exchangeInfo.symbols) {
        const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === params.symbol);
        if (symbolInfo) {
          const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
          tickSize = priceFilter?.tickSize || '0.01';
        }
      }

      retries++;
      if (retries > maxRetries) {
         console.warn(`[OMS Algo] Tick chaser max retries reached. Flooding market.`);
         if (currentOrderId) {
            broker.publish(TOPICS.EXECUTE_ORDER, {
              symbol: params.symbol,
              type: 'CANCEL',
              clientOrderId: currentOrderId,
              isShadow: params.isShadow
            } as any);
         }
         const fallbackPayload: any = { ...params, type: 'MARKET', internal_order_id: `${params.internal_order_id}-peg-last`, timestamp: Date.now() };
         delete fallbackPayload.algo;
         broker.publish(TOPICS.EXECUTE_ORDER, fallbackPayload);
         this.cancelAlgo(params.internal_order_id);
         broker.unsubscribe(TOPICS.EXECUTION_REPORT, onExec);
         return;
      }

      // Implement CANCEL_REPLACE natively
      if (isFilled) return;

      const newOrderId = `${params.internal_order_id}-peg-${retries}`;
      
      const orderPayload = {
        ...params,
        internal_order_id: newOrderId,
        type: currentOrderId ? 'CANCEL_REPLACE' : 'LIMIT_MAKER', 
        price: formatPrice(newTargetPrice, tickSize),
        timestamp: Date.now(),
        ...(currentOrderId ? { cancelReplaceClientOrderId: currentOrderId } : {})
      } as any;
      delete orderPayload.algo;

      currentTargetPrice = newTargetPrice;
      currentOrderId = newOrderId;

      broker.publish(TOPICS.EXECUTE_ORDER, orderPayload);
    };

    // Initial post
    tryPeg();
    
    const timer = setInterval(tryPeg, intervalMs);
    this.activeAlgos.set(params.internal_order_id, timer);
  }

  public cancelAlgo(internal_order_id: string) {
    const timer = this.activeAlgos.get(internal_order_id);
    if (timer) {
      clearInterval(timer);
      this.activeAlgos.delete(internal_order_id);
    }
    deleteAlgoState.run(internal_order_id);
    console.log(`[OMS Algo] Cancelled algo ${internal_order_id}`);
  }

  public dispatch(params: any) {
    if (params.algo === 'TWAP') {
      this.startTWAP(params);
    } else if (params.algo === 'VWAP') {
      this.startVWAP(params);
    } else if (params.algo === 'PEG_BBO') {
      this.startTickChaser(params);
    } else {
      console.warn(`[OMS Algo] Unknown algo type: ${params.algo}`);
    }
  }
}

export const algoExecutionManager = new ExecutionAlgorithms();
