import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketStore } from './useMarketStore';
import { MarketDataDepth } from '../../shared-contracts/types';

describe('useMarketStore (Sequence 5: Frontend State)', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useMarketStore.setState({
      activeSignals: [],
      currentOrderbook: null,
      activeIcebergs: [],
      isDiagnosticsEnabled: false,
    });
  });

  it('should initialize with default state', () => {
    const state = useMarketStore.getState();
    expect(state.activeSignals).toEqual([]);
    expect(state.currentOrderbook).toBeNull();
    expect(state.activeIcebergs).toEqual([]);
    expect(state.isDiagnosticsEnabled).toBe(false);
  });

  it('should add a signal and keep only the latest 5', () => {
    const { addSignal } = useMarketStore.getState();

    // Add 6 signals
    for (let i = 1; i <= 6; i++) {
      addSignal({ id: i, name: `Signal ${i}` });
    }

    const state = useMarketStore.getState();
    
    // Should only have 5 signals
    expect(state.activeSignals.length).toBe(5);
    
    // The most recent signal (id: 6) should be at the beginning
    expect(state.activeSignals[0].id).toBe(6);
    
    // The oldest signal (id: 1) should have been sliced off
    expect(state.activeSignals.find(s => s.id === 1)).toBeUndefined();
  });

  it('should set the orderbook correctly', () => {
    const { setOrderbook } = useMarketStore.getState();
    
    const mockOrderbook: MarketDataDepth = {
      symbol: 'BTCUSDT',
      timestamp: 1234567890,
      bids: [{ p: 60000, q: 1 }],
      asks: [{ p: 60001, q: 1 }],
      mid_price: 60000.5,
      bid_total_volume: 1,
      ask_total_volume: 1,
      imbalance: 0
    };

    setOrderbook(mockOrderbook);
    
    const state = useMarketStore.getState();
    expect(state.currentOrderbook).toEqual(mockOrderbook);
    
    // Test setting it back to null
    setOrderbook(null);
    expect(useMarketStore.getState().currentOrderbook).toBeNull();
  });

  it('should set icebergs correctly', () => {
    const { setIcebergs } = useMarketStore.getState();
    
    const mockIcebergs = [
      { id: 1, price: 60000, quantity: 10 },
      { id: 2, price: 61000, quantity: 5 }
    ];

    setIcebergs(mockIcebergs);
    
    const state = useMarketStore.getState();
    expect(state.activeIcebergs).toEqual(mockIcebergs);
  });

  it('should toggle diagnostics enabled state', () => {
    const { setDiagnosticsEnabled } = useMarketStore.getState();
    
    setDiagnosticsEnabled(true);
    expect(useMarketStore.getState().isDiagnosticsEnabled).toBe(true);
    
    setDiagnosticsEnabled(false);
    expect(useMarketStore.getState().isDiagnosticsEnabled).toBe(false);
  });
});
