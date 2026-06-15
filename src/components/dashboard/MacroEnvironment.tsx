import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Globe, AlertTriangle, TrendingUp, TrendingDown, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MacroEnvironmentProps {
  macroState: {
    state: string;
    killswitch_active: boolean;
    metrics: {
      dxy_price: number;
      dxy_z_score: number;
      yield_price: number;
      yield_z_score: number;
      sentiment: number;
      put_call_ratio?: number;
      implied_volatility?: number;
      gamma_flip_level?: number;
    } | null;
  };
}

export const MacroEnvironment = React.memo(({ macroState }: MacroEnvironmentProps) => {
  const { state = "CHOP", killswitch_active = false, metrics } = macroState || {};
  
  // Formatters
  const fNum = (n: number | null | undefined, dec = 2) => (n !== undefined && n !== null ? Number(n).toFixed(dec) : '0.00');
  const dxy = metrics?.dxy_price;
  const tnx = metrics?.yield_price;
  const dxyZ = metrics?.dxy_z_score || 0;
  const tnxZ = metrics?.yield_z_score || 0;
  const sent = metrics?.sentiment || 0;

  let stateColor = "text-muted-foreground";
  let stateBg = "bg-muted/10 border-muted/20";
  if (state === "RISK_ON") {
    stateColor = "text-green-500";
    stateBg = "bg-green-500/10 border-green-500/20";
  } else if (state === "RISK_OFF") {
    stateColor = "text-orange-500";
    stateBg = "bg-orange-500/10 border-orange-500/20";
  } else if (state === "SHOCK" || killswitch_active) {
    stateColor = "text-red-500";
    stateBg = "bg-red-500/10 border-red-500/30";
  }

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-primary/50 relative overflow-hidden">
      {/* Background Pulse for Shock */}
      <AnimatePresence>
        {killswitch_active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 bg-red-500/10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            <Globe className="w-4 h-4 text-primary" />
            Macro Environment
          </CardTitle>
          <CardDescription className="text-[10px]">Global Liquidity & Regime</CardDescription>
        </div>
        <div className={cn("px-3 py-1 rounded-full border flex items-center gap-2 text-xs font-bold", stateBg, stateColor)}>
          {state === "SHOCK" ? <AlertTriangle className="w-3 h-3" /> : <RefreshCcw className="w-3 h-3" />}
          {killswitch_active ? "HALTED : SHOCK" : state}
        </div>
      </CardHeader>
      
      <CardContent>
        {metrics ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {/* DXY Card */}
              <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">US Dollar (DXY)</span>
                <span className="font-mono text-sm font-bold">{fNum(dxy, 2)}</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0", dxyZ > 1.5 ? "text-red-400 border-red-500/30" : dxyZ < -1.5 ? "text-green-400 border-green-500/30" : "")}>
                    Z: {fNum(dxyZ, 1)}
                  </Badge>
                </div>
              </div>

              {/* US10Y Card */}
              <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">US 10Y Yield</span>
                <span className="font-mono text-sm font-bold">{fNum(tnx, 3)}%</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Badge variant="outline" className={cn("text-[9px] px-1 py-0", tnxZ > 2.0 ? "text-red-400 border-red-500/30" : tnxZ < -2.0 ? "text-green-400 border-green-500/30" : "")}>
                    Z: {fNum(tnxZ, 1)}
                  </Badge>
                </div>
              </div>

              {/* Sentiment Card */}
              <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">News Sentiment</span>
                <span className={cn("font-mono text-sm font-bold", sent > 0.1 ? "text-green-500" : sent < -0.1 ? "text-red-500" : "")}>
                  {sent > 0 ? '+' : ''}{fNum(sent, 2)}
                </span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {sent > 0.1 ? <TrendingUp className="w-3 h-3 text-green-500" /> : sent < -0.1 ? <TrendingDown className="w-3 h-3 text-red-500" /> : <span className="w-3 h-3 border-t-2 border-muted-foreground/50 self-center" />}
                </div>
              </div>
            </div>
            {metrics.put_call_ratio !== undefined && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Put/Call</span>
                  <span className={cn("font-mono text-sm font-bold", metrics.put_call_ratio > 1.2 ? "text-red-500" : metrics.put_call_ratio < 0.8 ? "text-green-500" : "")}>
                    {fNum(metrics.put_call_ratio, 2)}
                  </span>
                </div>
                <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Implied Vol</span>
                  <span className="font-mono text-sm font-bold">{fNum(metrics.implied_volatility, 1)}%</span>
                </div>
                <div className="flex flex-col p-2 bg-background/50 rounded-md border text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Gamma Flip</span>
                  <span className="font-mono text-sm font-bold text-pink-500">${fNum(metrics.gamma_flip_level, 0)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-[70px] flex items-center justify-center text-xs text-muted-foreground italic">
            Waiting for Macro Ingestion...
          </div>
        )}
      </CardContent>
    </Card>
  );
});

MacroEnvironment.displayName = 'MacroEnvironment';
