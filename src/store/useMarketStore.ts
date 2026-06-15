import { create } from 'zustand';
import { MarketDataDepth } from '../../shared-contracts/types';

interface MarketState {
  symbolInfo: any | null;
  activeSignals: any[];
  currentOrderbook: MarketDataDepth | null;
  activeIcebergs: any[];
  isDiagnosticsEnabled: boolean;
  isPaused: boolean;
  isHalted: boolean;
  klines: any[];
  smcData: { order_blocks: any[], fvgs?: any[] } | null;
  
  setSymbolInfo: (info: any) => void;
  addSignal: (signal: any) => void;
  clearSignals: () => void;
  setOrderbook: (orderbook: MarketDataDepth | null) => void;
  setIcebergs: (icebergs: any[]) => void;
  setDiagnosticsEnabled: (enabled: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  setIsHalted: (halted: boolean) => void;
  setKlines: (klines: any[] | ((prev: any[]) => any[])) => void;
  updateIndicators: (tf: string, indicators: any, ts?: number) => void;
  setSmcData: (data: { order_blocks: any[], fvgs?: any[] } | null) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  symbolInfo: null,
  activeSignals: [],
  currentOrderbook: null,
  activeIcebergs: [],
  isDiagnosticsEnabled: false,
  isPaused: false,
  isHalted: false,
  klines: [],
  smcData: null,

  setSymbolInfo: (info) => set({ symbolInfo: info }),
  
  addSignal: (signal) => set((state) => ({ 
    activeSignals: [signal, ...state.activeSignals].slice(0, 5) 
  })),

  clearSignals: () => set({ activeSignals: [] }),
  
  setOrderbook: (orderbook) => set({ currentOrderbook: orderbook }),
  
  setIcebergs: (icebergs) => set({ activeIcebergs: icebergs }),

  setDiagnosticsEnabled: (enabled) => set({ isDiagnosticsEnabled: enabled }),
  
  setIsPaused: (paused) => set({ isPaused: paused }),
  
  setIsHalted: (halted) => set({ isHalted: halted }),

  setKlines: (klinesPayload) => set((state) => ({
    klines: typeof klinesPayload === 'function' ? klinesPayload(state.klines) : klinesPayload,
  })),

  setSmcData: (data) => set({ smcData: data }),

  updateIndicators: (tf, indicators, ts) => set((state) => {
    const updated = [...state.klines];
    if (updated.length > 0) {
      if (ts) {
        // Convert exact timestamp to match formatted 'time' string used in frontend
        const date = new Date(ts);
        const isDateLevel = tf === '1d' || tf === '1w' || tf === '1M';
        const formattedTime = isDateLevel 
          ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
          : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const idx = updated.findIndex(k => k.time === formattedTime);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], indicators };
        } else {
          // If not exactly found, we can optionally append to the last one as fallback
          const lastIdx = updated.length - 1;
          updated[lastIdx] = { ...updated[lastIdx], indicators };
        }
      } else {
        // Intelligently append to the latest kline
        const lastIdx = updated.length - 1;
        updated[lastIdx] = { ...updated[lastIdx], indicators };
      }
    }
    return { klines: updated };
  }),
}));

