import { useEffect, useRef } from 'react';
import { useMarketStore } from '../store/useMarketStore';
import { useToast } from '../components/Toast';

/**
 * Custom hook to manage high-frequency WebSocket data for the DOM.
 */
export const useMarketDataWS = (symbol: string, resolution: string = '1m') => {
  const { addSignal, setOrderbook, clearSignals, isDiagnosticsEnabled, setIsHalted, updateIndicators } = useMarketStore();
  const { showToast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const throttleRef = useRef<number | null>(null);
  const errorThrottleRef = useRef<{ [key: string]: number }>({});
  const diagRef = useRef(isDiagnosticsEnabled);

  // Sync ref with state
  useEffect(() => {
    diagRef.current = isDiagnosticsEnabled;
  }, [isDiagnosticsEnabled]);

  useEffect(() => {
    if (!symbol) return;
    
    // Clear old data for new symbol
    clearSignals();
    setOrderbook(null);
    setIsHalted(false);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/signals`;
    let isCleaningUp = false;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useMarketDataWS] Connected to strategy signals');
        // Use ref to avoid stale closure and prevent hook re-triggering
        if (diagRef.current) {
          ws.send(JSON.stringify({ type: 'START_DIAGNOSTICS' }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.event === 'INDICATORS_UPDATE' && msg.data.symbol === symbol) {
            // Only apply indicator updates for the timeframe the user is currently viewing
            if (msg.data.tf === resolution) {
              updateIndicators(msg.data.tf, msg.data.indicators, msg.data.ts);
            }
          }

          if (msg.event === 'SMC_UPDATE' && msg.data.symbol === symbol) {
            if (msg.data.tf === resolution) {
              useMarketStore.getState().setSmcData({
                order_blocks: msg.data.order_blocks
              });
            }
          }

          if (msg.event === 'ACTIVE_SMC_CACHE') {
             const key = `${symbol}_${resolution}`;
             if (msg.data && msg.data[key]) {
               useMarketStore.getState().setSmcData({
                 order_blocks: msg.data[key].order_blocks
               });
             }
          }

          if (msg.event === 'LIVE_DOM_SIGNAL' && msg.data.symbol === symbol) {
            addSignal(msg.data);
            
            // Sync halt status
            if (msg.data.action === 'HALT') {
              setIsHalted(true);
            } else if (msg.data.action === 'RESUME') {
              setIsHalted(false);
            }
          }

          if (msg.event === 'EXECUTION_REPORT') {
            const side = msg.data.side || 'Order';
            const price = msg.data.average || msg.data.price || 'Market';
            showToast(`Execution: ${side} filled at ${price}`, 'success');
          }

          if (msg.event === 'EXECUTION_ERROR') {
            const errStr = String(msg.data.error);
            const now = Date.now();
            if (!errorThrottleRef.current[errStr] || now - errorThrottleRef.current[errStr] > 10000) {
              showToast(`System Error: ${errStr}`, 'error');
              errorThrottleRef.current[errStr] = now;
            }
          }

          if (msg.event === 'SYSTEM_INFO_MESSAGE') {
            // Suppress continuous SYSTEM_INFO_MESSAGE toasts as they irritate the user
            // if (msg.data && msg.data.type !== 'AUTOPILOT_LOG') {
            //   showToast(`${msg.data.message}`, msg.data.status === 'ERROR' ? 'error' : 'info');
            // }
          }
          
          // High-frequency orderbook updates (only if enabled)
          if (msg.event === 'depth' && msg.data.symbol === symbol) {
            if (!throttleRef.current) {
              throttleRef.current = window.setTimeout(() => {
                setOrderbook(msg.data);
                throttleRef.current = null;
              }, 150);
            }
          }
        } catch (err) {
          console.error('[useMarketDataWS] Parse error:', err);
        }
      };

      ws.onclose = (event) => {
        // Normal closure (like unmount) shouldn't trigger retry, but for robustness keep a small delay.
        if (event.code !== 1000 && !isCleaningUp) {
          console.log('[useMarketDataWS] Disconnected, retrying...');
          setTimeout(connect, 3000);
        }
      };

      ws.onerror = (err) => {
        if (!isCleaningUp) {
          console.error('[useMarketDataWS] WebSocket error:', err);
        }
        ws.close();
      };
    };

    connect();

    return () => {
      isCleaningUp = true;
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [symbol, addSignal, setOrderbook]); // Removed isDiagnosticsEnabled from here

  // Handle dynamic toggle of diagnostics without reconnecting
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (isDiagnosticsEnabled) {
        wsRef.current.send(JSON.stringify({ type: 'START_DIAGNOSTICS' }));
      } else {
        wsRef.current.send(JSON.stringify({ type: 'STOP_DIAGNOSTICS' }));
        setOrderbook(null);
      }
    }
  }, [isDiagnosticsEnabled, setOrderbook]);

  return null;
};
