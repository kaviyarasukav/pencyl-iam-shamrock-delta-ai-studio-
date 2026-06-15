import React, { useMemo, useEffect, useState } from 'react';
import { useMarketStore } from '../../store/useMarketStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatDisplayPrice } from '@/lib/precision';
import { Zap, Activity, X, Pause, Play } from 'lucide-react';

/**
 * Optimized Price Row Component
 */
const DOMRow = React.memo(({ 
  price, 
  bidSize, 
  askSize, 
  isMid, 
  isIceberg,
  obType,
  maxSize 
}: { 
  price: number; 
  bidSize: number; 
  askSize: number; 
  isMid: boolean;
  isIceberg: boolean;
  obType?: 'bullish' | 'bearish';
  maxSize: number;
}) => {
  const bidWidth = (bidSize / maxSize) * 100;
  const askWidth = (askSize / maxSize) * 100;

  return (
    <div className={cn(
      "grid grid-cols-12 gap-0 h-6 border-b border-border/10 text-[10px] items-center relative group transition-colors",
      isMid ? "bg-primary/10" : "hover:bg-muted/30",
      isIceberg && "bg-cyan-500/10 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]",
      obType === 'bullish' && "bg-green-500/10 border-l-2 border-l-green-500",
      obType === 'bearish' && "bg-red-500/10 border-r-2 border-r-red-500"
    )}>
      {/* Bid Side */}
      <div className="col-span-4 flex justify-end items-center pr-2 relative h-full">
        <div 
          className="absolute right-0 top-0 bottom-0 bg-green-500/20 transition-all duration-300" 
          style={{ width: `${bidWidth}%` }}
        />
        <span className={cn("relative z-10 font-mono", bidSize > 0 ? "text-green-500 font-bold" : "text-muted-foreground/30")}>
          {bidSize > 0 ? bidSize.toFixed(3) : '-'}
        </span>
      </div>

      {/* Price Center */}
      <div className={cn(
        "col-span-4 flex justify-center items-center font-mono font-bold border-x border-border/10 h-full relative z-10",
        isMid ? "text-primary" : "text-muted-foreground",
        isIceberg && "text-cyan-400"
      )}>
        {formatDisplayPrice(price)}
        {isIceberg && (
          <div className="absolute inset-0 animate-pulse bg-cyan-400/5 pointer-events-none" />
        )}
      </div>

      {/* Ask Side */}
      <div className="col-span-4 flex justify-start items-center pl-2 relative h-full">
        <div 
          className="absolute left-0 top-0 bottom-0 bg-red-500/20 transition-all duration-300" 
          style={{ width: `${askWidth}%` }}
        />
        <span className={cn("relative z-10 font-mono", askSize > 0 ? "text-red-500 font-bold" : "text-muted-foreground/30")}>
          {askSize > 0 ? askSize.toFixed(3) : '-'}
        </span>
      </div>
    </div>
  );
});

DOMRow.displayName = 'DOMRow';

export const DOMVisualizer = () => {
  const { currentOrderbook, activeSignals, activeIcebergs, isDiagnosticsEnabled, setDiagnosticsEnabled, symbolInfo, isHalted, isPaused, setIsPaused, smcData } = useMarketStore();
  const [showSignalToast, setShowSignalToast] = useState<any>(null);
  const [frozenOrderbook, setFrozenOrderbook] = useState<any>(null);

  // Sync frozen orderbook when not paused
  useEffect(() => {
    if (!isPaused && currentOrderbook) {
      setFrozenOrderbook(currentOrderbook);
    }
  }, [currentOrderbook, isPaused]);

  // Extract tickSize from symbolInfo filters
  const tickSize = parseFloat(symbolInfo?.filters?.find((f: any) => f.filterType === 'PRICE_FILTER')?.tickSize || '0.1');
  const precisionMultiplier = 1 / tickSize;

  // Handle Signal Toasts
  useEffect(() => {
    if (activeSignals.length > 0) {
      const latest = activeSignals[0];
      setShowSignalToast(latest);
      const timer = setTimeout(() => setShowSignalToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeSignals]);

  const displayOrderbook = isPaused ? frozenOrderbook : currentOrderbook;

  const ladderData = useMemo(() => {
    if (!displayOrderbook || !isDiagnosticsEnabled) return { rows: [], maxSize: 1 };

    const { bids, asks, mid_price } = displayOrderbook;
    
    // Create a range of prices around mid
    const range = 20;
    const rows = [];
    
    // Start from top (Asks)
    for (let i = range; i >= -range; i--) {
      const rawPrice = mid_price + i * tickSize;
      const price = Math.round(rawPrice * precisionMultiplier) / precisionMultiplier;
      
      const bid = bids.find(b => Math.abs(b.p - price) < tickSize / 2);
      const ask = asks.find(a => Math.abs(a.p - price) < tickSize / 2);
      const isIceberg = activeIcebergs.some(ice => Math.abs(ice.price - price) < tickSize / 2);
      
      const activeOb = smcData?.order_blocks?.find(ob => ob.status === 'active' && price >= Math.min(ob.top, ob.bottom) && price <= Math.max(ob.top, ob.bottom));

      rows.push({
        price,
        bidSize: bid ? bid.q : 0,
        askSize: ask ? ask.q : 0,
        isMid: Math.abs(price - mid_price) < tickSize / 2,
        isIceberg,
        obType: activeOb?.type
      });
    }

    const maxSize = Math.max(...rows.map(r => Math.max(r.bidSize, r.askSize)), 1);

    return { rows, maxSize };
  }, [displayOrderbook, activeIcebergs, isDiagnosticsEnabled, tickSize, precisionMultiplier, smcData]);

  return (
    <Card className="border-none shadow-2xl bg-card/30 backdrop-blur-md overflow-hidden relative">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-black uppercase tracking-tighter">
          <div className="flex items-center gap-2">
            <Activity className={cn("w-4 h-4 text-primary", !isPaused && "animate-pulse")} />
            Orderflow Diagnostics
          </div>
          <div className="flex items-center gap-2">
            {isDiagnosticsEnabled && (
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className={cn(
                  "p-1.5 rounded-full transition-all duration-200 border",
                  isPaused 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background/20 text-muted-foreground border-border/50 hover:border-primary/50"
                )}
                title={isPaused ? "Resume Feed" : "Pause / Freeze Feed"}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
            )}
            <button 
              onClick={() => setDiagnosticsEnabled(!isDiagnosticsEnabled)}
              className={cn(
                "px-2 py-1 rounded text-[9px] font-bold transition-all duration-200 uppercase tracking-tighter",
                isDiagnosticsEnabled 
                  ? "bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20" 
                  : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
              )}
            >
              {isDiagnosticsEnabled ? 'Stop Diagnostics' : 'Start Diagnostics'}
            </button>
            <Badge variant="outline" className={cn("text-[10px] font-mono border-primary/20", isPaused ? "text-muted-foreground" : "text-primary")}>
              {isPaused ? 'FROZEN' : 'LIVE'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative">
        {isHalted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-destructive/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center"
          >
            <X className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-black uppercase tracking-tighter">System Halted</h3>
            <p className="text-sm font-medium mt-2 opacity-90">Buster Call executed. All trading for this symbol has been suspended.</p>
            <div className="mt-6 p-3 bg-white/10 rounded-lg border border-white/20 text-[10px] font-mono uppercase">
              Manual Override Required
            </div>
          </motion.div>
        )}
        {!isDiagnosticsEnabled ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10">
              <Activity className="w-6 h-6 text-primary/20" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground/80">Performance Mode</h3>
              <p className="text-[10px] text-muted-foreground max-w-[220px] mt-2 leading-relaxed">
                High-frequency DOM rendering is paused to prioritize bot execution speed. 
                Intelligence engines are still running in the background.
              </p>
            </div>
            <button 
              onClick={() => setDiagnosticsEnabled(true)}
              className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
            >
              Enable Visual Audit
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-0 px-4 py-1 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20">
              <div className="col-span-4 text-right pr-2">Bids</div>
              <div className="col-span-4 text-center">Price</div>
              <div className="col-span-4 text-left pl-2">Asks</div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="px-4">
                {ladderData.rows?.map((row) => (
                  <DOMRow 
                    key={row.price}
                    price={row.price}
                    bidSize={row.bidSize}
                    askSize={row.askSize}
                    isMid={row.isMid}
                    isIceberg={row.isIceberg}
                    obType={row.obType as any}
                    maxSize={ladderData.maxSize}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Signal Overlay Toast */}
        <AnimatePresence>
          {showSignalToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="absolute inset-x-4 bottom-4 z-50"
            >
              <div className="bg-yellow-500 text-black p-3 rounded-xl shadow-2xl flex flex-col gap-1 border-2 border-yellow-400">
                <div className="flex items-center gap-2 font-black uppercase text-xs">
                  <Zap className="w-4 h-4 fill-current" />
                  {showSignalToast.direction} SIGNAL TRIGGERED
                </div>
                <div className="text-[10px] font-bold opacity-80">
                  CVD: {showSignalToast.conditions_met?.cvd_slope} | 
                  Z: {showSignalToast.conditions_met?.z_score} | 
                  Ice: {showSignalToast.conditions_met?.iceberg_distance}%
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
