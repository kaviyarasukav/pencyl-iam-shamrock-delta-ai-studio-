import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Globe, AlertTriangle, TrendingUp, TrendingDown, RefreshCcw, Clock, ShieldAlert, ActivitySquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MacroContextProps {
  macroState: {
    state: string;
    killswitch_active: boolean;
    upcoming_events?: string[]; // ISO Strings
    metrics: {
      dxy_price: number;
      dxy_z_score: number;
      yield_price: number;
      yield_spread: number;
      yield_z_score: number;
      sentiment: number;
      put_call_ratio: number;
      implied_volatility: number;
    } | null;
  };
}

export const MacroContext = ({ macroState }: MacroContextProps) => {
  const { state = "CHOP", killswitch_active = false, metrics, upcoming_events = [] } = macroState || {};
  
  // Formatters
  const fNum = (n: number | null | undefined, dec = 2) => (n !== undefined && n !== null ? Number(n).toFixed(dec) : '0.00');
  
  const dxy = metrics?.dxy_price;
  const dxyZ = metrics?.dxy_z_score || 0;
  
  const tnx = metrics?.yield_price;
  const tnxSpread = metrics?.yield_spread || 0;
  const tnxZ = metrics?.yield_z_score || 0;
  
  const sent = metrics?.sentiment || 0;
  const pcr = metrics?.put_call_ratio || 0;
  const iv = metrics?.implied_volatility || 0;

  // Banner Colors (Glowing red/green/yellow)
  let bannerColor = "bg-muted/10 border-muted/20 text-muted-foreground shadow-none";
  let bannerLabel = "CHOP / MEAN REVERSION";
  
  if (state === "RISK_ON") {
    bannerColor = "bg-green-500/20 border-green-500/50 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]";
    bannerLabel = "RISK ON / LONG BIAS";
  } else if (state === "RISK_OFF") {
    bannerColor = "bg-orange-500/20 border-orange-500/50 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]";
    bannerLabel = "RISK OFF / SHORT BIAS";
  } else if (state === "SHOCK" || killswitch_active) {
    bannerColor = "bg-red-500/20 border-red-500/60 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]";
    bannerLabel = "SHOCK / TRADING HALTED";
  }

  // Timer Countdown Logic
  const [nextEventTime, setNextEventTime] = useState<string | null>(null);

  useEffect(() => {
    if (!upcoming_events || upcoming_events.length === 0) {
      setNextEventTime(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      // Find the next upcoming event that is in the future or very recently past (-10 mins)
      const upcoming = upcoming_events.find(ev => new Date(ev).getTime() > now - 600000);
      
      if (upcoming) {
        const eventTime = new Date(upcoming).getTime();
        const diff = eventTime - now;
        
        if (diff <= 0 && diff > -600000) {
          setNextEventTime("ACTIVE SHOCK WINDOW");
        } else if (diff > 0) {
          const h = Math.floor(diff / (1000 * 60 * 60));
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const s = Math.floor((diff % (1000 * 60)) / 1000);
          setNextEventTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
          setNextEventTime("PASSED");
        }
      } else {
        setNextEventTime(null);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [upcoming_events]);

  return (
    <Card className="border-none shadow-2xl bg-card border border-border/50 overflow-hidden relative">
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-center mb-2">
           <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
             <Globe className="w-5 h-5 text-primary" />
             Market Climate
           </CardTitle>
           {killswitch_active && (
              <Badge variant="destructive" className="animate-pulse">KILLSWITCH ACTIVE</Badge>
           )}
        </div>
        
        {/* Top Banner: Current Regime State */}
        <div className={cn("p-2 rounded-lg border flex items-center justify-center font-bold tracking-[0.2em] transition-all duration-500", bannerColor)}>
          {state === "SHOCK" ? <AlertTriangle className="w-4 h-4 mr-2" /> : <ActivitySquare className="w-4 h-4 mr-2" />}
          {bannerLabel}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Panel: Live Tickers */}
        <div className="md:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* DXY */}
          <div className="bg-background/80 rounded-md p-3 border border-border/50 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">US Dollar</span>
            <span className="font-mono text-sm font-bold">{fNum(dxy, 2)}</span>
            <Badge variant="outline" className={cn("mt-1 text-[9px] px-1.5 py-0.5", dxyZ > 1.5 ? "text-green-400 border-green-500/30" : dxyZ < -1.5 ? "text-red-400 border-red-500/30" : "text-muted-foreground")}>
              Z: {fNum(dxyZ, 2)}
            </Badge>
          </div>

          {/* US10Y Yield */}
          <div className="bg-background/80 rounded-md p-3 border border-border/50 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">10Y Yield</span>
            <span className="font-mono text-sm font-bold">{fNum(tnx * 100, 3)}%</span>
            <div className="flex gap-1 mt-1">
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0.5", tnxSpread < 0 ? "text-red-400 border-red-500/30" : "text-green-400 border-green-500/30")}>
                Sprd: {fNum(tnxSpread * 10000, 0)} BPS
              </Badge>
              <Badge variant="outline" className={cn("text-[8px] px-1 py-0.5", tnxZ > 2.0 ? "text-green-400 border-green-500/30" : tnxZ < -2.0 ? "text-red-400 border-red-500/30" : "text-muted-foreground")}>
                Z: {fNum(tnxZ, 2)}
              </Badge>
            </div>
          </div>

          {/* Put/Call Ratio */}
          <div className="bg-background/80 rounded-md p-3 border border-border/50 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Put/Call Ratio</span>
            <span className="font-mono text-sm font-bold">{fNum(pcr, 2)}</span>
            <Badge variant="outline" className={cn("mt-1 text-[9px] px-1.5 py-0.5", pcr > 1.2 ? "text-red-400 border-red-500/30" : pcr < 0.8 ? "text-green-400 border-green-500/30" : "text-muted-foreground")}>
              IV: {fNum(iv, 1)}%
            </Badge>
          </div>
          
          {/* Sentiment */}
          <div className="bg-background/80 rounded-md p-3 border border-border/50 flex flex-col items-center justify-center">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Sentiment</span>
            <span className={cn("font-mono text-sm font-bold", sent > 0.1 ? "text-green-500" : sent < -0.1 ? "text-red-500" : "")}>
              {sent > 0 ? '+' : ''}{fNum(sent, 2)}
            </span>
            <div className="flex items-center justify-center gap-1 mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
              {sent > 0.1 ? 'BULLISH' : sent < -0.1 ? 'BEARISH' : 'NEUTRAL'}
            </div>
          </div>
        </div>

        {/* Right Panel: Event Countdown */}
        <div className="bg-background/50 rounded-lg border border-border/50 flex flex-col p-4 relative overflow-hidden h-full">
           <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
             <Clock className="w-24 h-24" />
           </div>
           
           <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
             Next High-Impact Event
           </h3>
           
           <div className="flex-1 flex flex-col items-center justify-center">
             {nextEventTime ? (
               <div className="text-center">
                 <div className={cn(
                   "font-mono text-3xl font-black tracking-tight",
                   nextEventTime === "ACTIVE SHOCK WINDOW" ? "text-red-500 animate-pulse" : "text-primary"
                 )}>
                   {nextEventTime}
                 </div>
                 {nextEventTime !== "ACTIVE SHOCK WINDOW" && (
                   <div className="text-[10px] mt-2 text-muted-foreground uppercase tracking-widest">
                     Time Until Lockout
                   </div>
                 )}
               </div>
             ) : (
               <div className="text-center text-muted-foreground flex flex-col items-center">
                 <ShieldAlert className="w-6 h-6 mb-2 opacity-20" />
                 <span className="text-xs font-medium uppercase tracking-wider">No Events Listed</span>
               </div>
             )}
           </div>
        </div>
      </CardContent>
    </Card>
  );
};
