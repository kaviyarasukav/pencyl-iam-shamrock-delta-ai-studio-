import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Shield, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StrategyMonitorProps {
  lastKline: any;
  cvdData: any;
  macroState: any;
}

export const StrategyMonitor = React.memo(({ lastKline, cvdData, macroState }: StrategyMonitorProps) => {
  const [activeStrategies, setActiveStrategies] = React.useState<string[]>([]);

  React.useEffect(() => {
    const fetchMode = () => {
      fetch('/api/settings/mode')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d.mode) {
            setActiveStrategies(Array.isArray(d.mode) ? d.mode : [d.mode]);
          }
        })
        .catch();
    };

    fetchMode();
    const interval = setInterval(fetchMode, 5000);
    return () => clearInterval(interval);
  }, []);

  // Use python indicators for strategy state
  const signal = lastKline?.indicators?.supertrend_direction === 1 ? 'buy' : lastKline?.indicators?.supertrend_direction === -1 ? 'sell' : 'none';
  const rsi = lastKline?.indicators?.rsi ?? 50;
  const cvd = cvdData?.cvd || 0;
  const levMult = macroState?.metrics?.yield_z_score > 1.5 ? (macroState?.metrics?.yield_z_score > 2.5 ? 0.25 : macroState?.metrics?.yield_z_score > 2.0 ? 0.5 : 0.75) : 1.0;

  const getStatus = () => {
    if (macroState?.killswitch_active) return { label: 'ALGO HALTED (MACRO)', color: 'text-red-500', icon: AlertCircle };
    if (levMult < 1.0) return { label: 'CHOKING LEVERAGE', color: 'text-orange-500', icon: Shield };
    if (signal === 'buy' && cvd > 0) return { label: 'AGGRESSIVE BUYING', color: 'text-green-500', icon: Target };
    if (signal === 'sell' && cvd < 0) return { label: 'AGGRESSIVE SELLING', color: 'text-red-500', icon: Shield };
    if (rsi > 70) return { label: 'OVERBOUGHT / CAUTION', color: 'text-orange-500', icon: AlertCircle };
    if (rsi < 30) return { label: 'OVERSOLD / OPPORTUNITY', color: 'text-blue-500', icon: Activity };
    return { label: 'HUNTING FOR SETUP', color: 'text-primary', icon: Activity };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Activity className="w-4 h-4 text-primary" />
          Strategy Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-border/50 shadow-inner">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg bg-background shadow-md", status.color)}>
                <StatusIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Mode</p>
                <p className={cn("text-sm font-black uppercase", status.color)}>{status.label}</p>
              </div>
            </div>
            <Badge variant="outline" className="animate-pulse bg-green-500/10 text-green-500 border-green-500/20">
              ACTIVE
            </Badge>
          </div>

          {activeStrategies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {activeStrategies.map(s => (
                <Badge key={s} variant="secondary" className="text-[8px] font-bold px-1.5 py-0 bg-primary/20 text-primary border-primary/30 uppercase">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 rounded-lg bg-muted/30 border border-muted/50">
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Trend Signal</p>
              <div className="flex items-center gap-1.5">
                {signal === 'buy' ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : signal === 'sell' ? (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <Activity className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-xs font-bold uppercase">{signal || 'Neutral'}</span>
              </div>
            </div>
            
            <div className="p-2 rounded-lg bg-muted/30 border border-muted/50">
              <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">RSI Status</p>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  rsi > 70 ? "bg-red-500" : rsi < 30 ? "bg-green-500" : "bg-primary"
                )} />
                <span className="text-xs font-bold">{rsi.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
              <span>Lev Multiplier</span>
              <span className={cn(levMult < 1.0 ? "text-orange-500" : "text-primary")}>
                {levMult === 1 ? 'FULL' : `${(levMult * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-1000", levMult < 1.0 ? "bg-orange-500" : "bg-primary")} 
                style={{ width: `${levMult * 100}%` }} 
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StrategyMonitor.displayName = 'StrategyMonitor';
