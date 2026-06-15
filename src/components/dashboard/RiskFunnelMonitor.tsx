import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RiskFunnelMonitor = React.memo(() => {
  const [riskState, setRiskState] = useState<any>(null);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');
    eventSource.addEventListener('risk_state', (e) => {
      try {
        const data = JSON.parse(e.data);
        setRiskState(data);
      } catch (err) {}
    });

    return () => {
      eventSource.close();
    };
  }, []);

  if (!riskState) {
    return null; // Don't show until we get first ping
  }

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <Shield className="w-4 h-4 text-orange-500" />
          Execution Funnel & Risk State
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="p-3 bg-muted/30 border border-muted/50 rounded-xl">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Portfolio Heat</p>
              <div className="flex items-end gap-2">
                <span className={cn(
                  "text-xl font-black",
                  riskState.portfolio_heat_pct > riskState.max_portfolio_heat * 80 ? "text-red-500" : "text-primary"
                )}>
                  {riskState.portfolio_heat_pct}%
                </span>
                <span className="text-[9px] text-muted-foreground mb-1 leading-none">/ {(riskState.max_portfolio_heat * 100).toFixed(0)}% MAX</span>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-muted/50 rounded-xl">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Daily Drawdown</p>
              <div className="flex items-end gap-2">
                <span className={cn(
                  "text-xl font-black",
                  riskState.drawdown_pct > 3 ? "text-orange-500" : "text-primary"
                )}>
                  {riskState.drawdown_pct}%
                </span>
                <span className="text-[9px] text-muted-foreground mb-1 leading-none">/ {(riskState.max_daily_drawdown * 100).toFixed(0)}% LIMIT</span>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-muted/50 rounded-xl">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Active Positions</p>
              <div className="flex items-end gap-2">
                <span className="text-xl font-black text-primary">
                  {riskState.open_trades_count}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-muted/30 border border-muted/50 rounded-xl">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Kelly Multiplier</p>
              <div className="flex items-center gap-2 h-full pb-1">
                <span className="text-sm font-bold text-green-500">
                  Adaptive (A+ 2x)
                </span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-background/50 rounded-xl border border-border/50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              The 5-Gate Funnel (State)
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Gate 1: Macro Weather</span>
                <span className={cn("font-bold flex items-center gap-1", riskState.killswitch_active ? "text-red-500" : "text-green-500")}>
                  {riskState.killswitch_active ? 'HALTED' : "ALLOW"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Gate 2: HTF Radar</span>
                <span className="font-bold text-primary">ENFORCING BIAS</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Gate 3: LTF Sniper</span>
                <span className="font-bold text-green-500">ARMED</span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Gate 4: Risk Shield</span>
                <span className={cn("font-bold", riskState.portfolio_heat_pct >= riskState.max_portfolio_heat * 100 ? "text-red-500" : "text-green-500")}>
                  {riskState.portfolio_heat_pct >= riskState.max_portfolio_heat * 100 ? 'BLOCKED' : "READY"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">Gate 5: Executioner</span>
                <span className="font-bold text-primary">LIMIT CHASE</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

RiskFunnelMonitor.displayName = 'RiskFunnelMonitor';
