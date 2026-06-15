import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Activity, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplayPrice } from '@/lib/precision';
import { useMarketStore } from '../../store/useMarketStore';
import { usePerformanceConfig } from '../../hooks/usePerformanceConfig';

export const MarketDepth = React.memo(() => {
  const { currentOrderbook: orderBook, isDiagnosticsEnabled, setDiagnosticsEnabled, isPaused, setIsPaused } = useMarketStore();
  const [frozenOrderbook, setFrozenOrderbook] = useState<any>(null);
  const { isMobile } = usePerformanceConfig();

  // Auto-disable diagnostics on mobile to prevent thrashing
  useEffect(() => {
    if (isMobile && isDiagnosticsEnabled) {
      setDiagnosticsEnabled(false);
    }
  }, [isMobile]);

  // If not paused, sync the frozenOrderbook with the real store orderbook
  useEffect(() => {
    if (!isPaused && orderBook) {
      setFrozenOrderbook(orderBook);
    }
  }, [orderBook, isPaused]);

  // Use the frozen (or live) orderbook for rendering
  const displayOrderbook = isPaused ? frozenOrderbook : orderBook;
  const imbalance = displayOrderbook?.imbalance || 0;

  return (
    <Card className="lg:col-span-1 border-none shadow-xl bg-card/50 backdrop-blur-sm relative overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Market Depth
          </div>
          <div className="flex items-center gap-2">
            {isDiagnosticsEnabled && (
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  "p-1.5 rounded-full transition-all duration-200 border",
                  isPaused 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background/50 text-muted-foreground border-border hover:border-primary/50"
                )}
                title={isPaused ? "Resume Feed" : "Pause / Freeze Feed"}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            )}
            {isDiagnosticsEnabled && imbalance !== undefined && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px]", 
                  imbalance > 0 
                    ? "text-green-500 border-green-500/20 bg-green-500/10" 
                    : "text-red-500 border-red-500/20 bg-red-500/10"
                )}
              >
                OBI: {(imbalance * 100).toFixed(1)}%
              </Badge>
            )}
          </div>
        </CardTitle>
        <CardDescription>Real-time Orderflow</CardDescription>
      </CardHeader>
      <CardContent>
        {!isDiagnosticsEnabled ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-center p-4 space-y-3">
            <Activity className="w-8 h-8 text-primary/20" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Depth data is paused in Performance Mode.
            </p>
            <button 
              onClick={() => setDiagnosticsEnabled(true)}
              className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
            >
              Enable Depth
            </button>
          </div>
        ) : (
          <>
            <div className={cn("grid grid-cols-2 gap-4 text-xs font-mono transition-opacity duration-300", isPaused && "opacity-60")}>
              <div className="space-y-1">
                <p className="font-bold text-green-500 mb-2 flex justify-between items-center">
                  <span>Bids</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Vol: {(displayOrderbook?.bid_total_volume || 0).toFixed(0)}
                  </span>
                </p>
                {Array.isArray(displayOrderbook?.bids) && displayOrderbook.bids.slice(0, 10).map((b: any, i: number) => (
                  <div key={i} className="flex justify-between py-0.5 border-b border-muted/10 last:border-0 hover:bg-green-500/5 transition-colors px-1 rounded">
                    <span className="text-green-500/90">{formatDisplayPrice(b.p)}</span>
                    <span className="text-muted-foreground/80">{(b.q || 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="font-bold text-red-500 mb-2 flex justify-between items-center">
                  <span>Asks</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Vol: {(displayOrderbook?.ask_total_volume || 0).toFixed(0)}
                  </span>
                </p>
                {Array.isArray(displayOrderbook?.asks) && displayOrderbook.asks.slice(0, 10).map((a: any, i: number) => (
                  <div key={i} className="flex justify-between py-0.5 border-b border-muted/10 last:border-0 hover:bg-red-500/5 transition-colors px-1 rounded">
                    <span className="text-red-500/90">{formatDisplayPrice(a.p)}</span>
                    <span className="text-muted-foreground/80">{(a.q || 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Imbalance Visualizer Bar */}
            {displayOrderbook?.imbalance !== undefined && (
              <div className={cn("mt-6 space-y-1.5 transition-opacity", isPaused && "opacity-60")}>
                <div className="flex justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  <span>Buy Pressure</span>
                  <span>Sell Pressure</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500 ease-out" 
                    style={{ width: `${50 + (imbalance * 50)}%` }}
                  />
                  <div 
                    className="h-full bg-red-500 transition-all duration-500 ease-out" 
                    style={{ width: `${50 - (imbalance * 50)}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

MarketDepth.displayName = 'MarketDepth';
