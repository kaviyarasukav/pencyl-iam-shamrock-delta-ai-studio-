import { useState, useEffect, useCallback, useRef } from 'react';
import { TickerData, KlineData, OpenOrder, TradeData } from '../services/ExchangeService';
import { useExchange } from '../contexts/ExchangeContext';

import { useMarketStore } from '../store/useMarketStore';

export const useBinanceData = (selectedSymbol: string, resolution: string) => {
  const { api, exchange } = useExchange();
  const { setIcebergs: setIcebergsStore, setSymbolInfo: setSymbolInfoStore, klines, setKlines } = useMarketStore();
  const [symbolInfo, setSymbolInfo] = useState<any>(null);
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [volumeSpikes, setVolumeSpikes] = useState<any[]>([]);
  const [cvdData, setCvdData] = useState<any>(null);
  const [largeOrders, setLargeOrders] = useState<any[]>([]);
  const [liquidityShifts, setLiquidityShifts] = useState<any[]>([]);
  const [optionsFlow, setOptionsFlow] = useState<any[]>([]);
  const [optionsSweeps, setOptionsSweeps] = useState<any[]>([]);
  const [gammaExposure, setGammaExposure] = useState<any[]>([]);
  const [icebergs, setIcebergs] = useState<any[]>([]);
  const [spoofing, setSpoofing] = useState<any[]>([]);
  const [strategySignals, setStrategySignals] = useState<any[]>([]);
  const [macroRegime, setMacroRegime] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Safety timeout for loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000); // 5 seconds safety fallback
    return () => clearTimeout(timer);
  }, []);

  const fetchSymbolInfo = useCallback(async () => {
    try {
      const info = await api.getProductDetails(selectedSymbol);
      setSymbolInfo(info);
      setSymbolInfoStore(info);
    } catch (err) {
      console.error('Failed to fetch symbol info:', err);
    }
  }, [api, selectedSymbol, setSymbolInfoStore]);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [tickerData, klineData] = await Promise.all([
        api.getTickers().catch(e => { console.error(e); return null; }),
        api.getKlines(selectedSymbol, resolution).catch(e => { console.error(e); return null; }),
        fetchSymbolInfo()
      ]);
      
      if (tickerData) setTickers(tickerData);
      
      if (klineData && Array.isArray(klineData)) {
        setKlines(klineData);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, selectedSymbol, resolution]);

  const fetchFastData = useCallback(async () => {
    try {
      const [tradesData] = await Promise.all([
        api.getTrades(selectedSymbol).catch(e => { console.error(e); return null; })
      ]);
      
      if (tradesData) setTrades(tradesData);
    } catch (error) {
      console.error("Failed to fetch fast data", error);
    }
  }, [api, selectedSymbol]);

  useEffect(() => {
    // Clear previous symbol data
    setTrades([]);
    setVolumeSpikes([]);
    setCvdData(null);
    setLargeOrders([]);
    setLiquidityShifts([]);
    setOptionsFlow([]);
    setOptionsSweeps([]);
    setGammaExposure([]);
    setIcebergs([]);
    setSpoofing([]);
    setStrategySignals([]);
    setLoading(true);

    fetchData();
    fetchFastData();
    
    // Setup SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    const es = new EventSource('/api/stream');
    eventSourceRef.current = es;

    es.addEventListener('trade', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol && data.data) {
          setTrades(prev => {
            const newTrade = { 
              price: data.data.p || '0', 
              qty: data.data.q || '0', 
              time: data.data.T || Date.now(), 
              isBuyerMaker: !!data.data.m 
            };
            return [newTrade, ...prev].slice(0, 20);
          });
        }
      } catch (err) {}
    });

    es.addEventListener('volume_spike', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setVolumeSpikes(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('cvd', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setCvdData(data);
        }
      } catch (err) {}
    });

    es.addEventListener('large_order', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setLargeOrders(prev => [data, ...prev].slice(0, 20));
        }
      } catch (err) {}
    });

    es.addEventListener('liquidity_shift', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setLiquidityShifts(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('options_flow', (e) => {
      try {
        const data = JSON.parse(e.data);
        // Match underlying asset (e.g. BTC in BTCUSDT)
        const underlying = selectedSymbol.replace('USDT', '').replace('BUSD', '');
        if (data && data.symbol === underlying) {
          setOptionsFlow(prev => [data, ...prev].slice(0, 20));
        }
      } catch (err) {}
    });

    es.addEventListener('options_sweep', (e) => {
      try {
        const data = JSON.parse(e.data);
        const underlying = selectedSymbol.replace('USDT', '').replace('BUSD', '');
        if (data && data.symbol === underlying) {
          setOptionsSweeps(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('gamma_exposure', (e) => {
      try {
        const data = JSON.parse(e.data);
        const underlying = selectedSymbol.replace('USDT', '').replace('BUSD', '');
        if (data && data.symbol === underlying) {
          setGammaExposure(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('iceberg', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setIcebergs(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('spoofing', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.symbol === selectedSymbol) {
          setSpoofing(prev => [data, ...prev].slice(0, 10));
        }
      } catch (err) {}
    });

    es.addEventListener('macro_regime', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data) {
          setMacroRegime(data);
        }
      } catch (err) {}
    });

    es.addEventListener('candle_closed', (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.symbol === selectedSymbol && msg.data) {
          if (msg.data.tf === resolution || (resolution === '1m' && msg.data.tf === '1m')) {
            setKlines(prev => {
              const updated = [...prev];
              if (updated.length > 0) {
                const newTime = new Date(msg.data.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                // Either update last or append if time differs
                const lastKline = updated[updated.length - 1];
                if (lastKline.time === newTime) {
                  updated[updated.length - 1] = {
                    time: newTime,
                    price: msg.data.c,
                    volume: msg.data.v,
                    indicators: msg.data.indicators || lastKline.indicators
                  };
                } else {
                  updated.push({
                    time: newTime,
                    price: msg.data.c,
                    volume: msg.data.v,
                    indicators: msg.data.indicators
                  });
                  if (updated.length > 200) updated.shift();
                }
              }
              return updated;
            });
          }
        }
      } catch (err) {}
    });

    es.addEventListener('indicators_update', (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.symbol === selectedSymbol) {
          if (msg.tf === resolution || (resolution === '1m' && msg.tf === '1m')) {
            setKlines(prev => {
              const updated = [...prev];
              if (updated.length > 0) {
                const indKeys = Object.keys(msg.indicators);
                for (const key of indKeys) {
                  if (Array.isArray(msg.indicators[key])) {
                    const arr = msg.indicators[key];
                    let uiIdx = updated.length - 1;
                    let pyIdx = arr.length - 1;
                    while (uiIdx >= 0 && pyIdx >= 0) {
                      updated[uiIdx] = {
                        ...updated[uiIdx],
                        indicators: {
                          ...(updated[uiIdx].indicators || {}),
                          [key]: arr[pyIdx]
                        }
                      };
                      uiIdx--;
                      pyIdx--;
                    }
                  } else if (msg.indicators[key] && typeof msg.indicators[key] === 'object' && !Array.isArray(msg.indicators[key])) {
                    // Complex object e.g. MACD
                    const subkeys = Object.keys(msg.indicators[key]);
                    const isArrayObject = subkeys.length > 0 && Array.isArray(msg.indicators[key][subkeys[0]]);
                    if (isArrayObject) {
                      let uiIdx = updated.length - 1;
                      let pyIdx = msg.indicators[key][subkeys[0]].length - 1;
                      while (uiIdx >= 0 && pyIdx >= 0) {
                        const complexVal: any = {};
                        for (const sk of subkeys) complexVal[sk] = msg.indicators[key][sk][pyIdx];
                        updated[uiIdx] = {
                          ...updated[uiIdx],
                          indicators: {
                            ...(updated[uiIdx].indicators || {}),
                            [key]: complexVal
                          }
                        };
                        uiIdx--;
                        pyIdx--;
                      }
                    } else {
                      updated[updated.length - 1] = {
                        ...updated[updated.length - 1],
                        indicators: {
                          ...(updated[updated.length - 1].indicators || {}),
                          [key]: msg.indicators[key]
                        }
                      };
                    }
                  } else {
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      indicators: {
                        ...(updated[updated.length - 1].indicators || {}),
                        [key]: msg.indicators[key]
                      }
                    };
                  }
                }
              }
              return updated;
            });
          }
        }
      } catch (err) {}
    });

    const slowInterval = setInterval(fetchData, 10000);
    // SSE handles real-time updates, keep this as a slow fallback
    const fastInterval = setInterval(fetchFastData, 30000); 
    
    return () => {
      clearInterval(slowInterval);
      clearInterval(fastInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchData, fetchFastData, selectedSymbol]);

  useEffect(() => {
    setIcebergsStore(icebergs);
  }, [icebergs, setIcebergsStore]);

  return { symbolInfo, tickers, klines, trades, volumeSpikes, cvdData, largeOrders, liquidityShifts, optionsFlow, optionsSweeps, gammaExposure, icebergs, spoofing, strategySignals, macroRegime, loading, refreshing };
};
