import React, { useState, useEffect, useRef } from 'react';
import { Switch } from '../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Activity, Power, Radar, Shield, Terminal, Settings } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useMarketStore } from '../../store/useMarketStore';

export const AutopilotDashboard: React.FC = () => {
  const [isAutopilotOn, setIsAutopilotOn] = useState(false);
  const [logs, setLogs] = useState<{ symbol: string; message: string; timestamp: Date }[]>([]);
  const [trackedAssets, setTrackedAssets] = useState<string[]>([]);

  useEffect(() => {
    // Fetch initial autopilot state
    fetch('/api/settings/autopilot')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
         if (!data) return;
         setIsAutopilotOn(data.isAutopilotOn || false);
      })
      .catch(console.error);
      
    // Fetch tracked assets
    const fetchAssets = () => {
       fetch('/api/settings/autopilot/tracked-assets')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && data.trackedAssets) {
                setTrackedAssets(data.trackedAssets);
            }
        })
        .catch(console.error);
    };
    fetchAssets();
    const intv = setInterval(fetchAssets, 10000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/signals`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'system_info' || msg.event === 'ALPHA_SIGNAL') {
          // If the server forwards it
          if (msg.data?.type === 'AUTOPILOT_LOG') {
            setLogs(prev => {
              const newLogs = [...prev, { symbol: msg.data.symbol, message: msg.data.message, timestamp: new Date() }];
              return newLogs.slice(-50); // Keep last 50 logs
            });
          }
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, []);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const toggleAutopilot = async () => {
    const newState = !isAutopilotOn;
    try {
      await fetch('/api/settings/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           enabled: newState
        })
      });
      setIsAutopilotOn(newState);
      if (newState) {
          setLogs(prev => [...prev, { symbol: 'SYSTEM', message: 'Autopilot Engaged. AI Matrix assumed autonomous control over conviction, execution, and risk bounds.', timestamp: new Date() }]);
      } else {
          setLogs(prev => [...prev, { symbol: 'SYSTEM', message: 'Autopilot Disengaged.', timestamp: new Date() }]);
      }
    } catch (e) {
      console.error('Failed to toggle autopilot');
    }
  };

  return (
    <Card className={`col-span-1 border-border/50 bg-card/50 backdrop-blur-sm shadow-xl transition-all duration-500 overflow-hidden relative ${isAutopilotOn ? 'ring-2 ring-primary/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]' : ''}`}>
      {isAutopilotOn && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      )}
      <CardHeader className="border-b border-border/50 pb-5 pt-6 bg-gradient-to-b from-card to-transparent">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
             <div className="flex items-center gap-3">
               <div className={`p-3 rounded-lg ${isAutopilotOn ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                 <Radar className="h-6 w-6" />
               </div>
               <div>
                 <CardTitle className="text-lg md:text-xl font-black uppercase tracking-widest text-foreground">
                   Autopilot Matrix
                 </CardTitle>
                 <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                   Status: 
                   <span className={isAutopilotOn ? "text-primary font-bold" : "text-destructive font-bold"}>
                     {isAutopilotOn ? "ENGAGED" : "OFFLINE"}
                   </span>
                 </div>
               </div>
             </div>
             
             {isAutopilotOn ? (
                 <button 
                    onClick={toggleAutopilot}
                    className="w-full md:w-auto group relative px-6 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold font-mono tracking-widest text-sm rounded-lg border border-destructive/50 transition-all overflow-hidden"
                 >
                     <span className="relative z-10">SHUTDOWN</span>
                     <div className="absolute inset-0 bg-destructive/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                 </button>
             ) : (
                 <button 
                    onClick={toggleAutopilot}
                    className="w-full md:w-auto group relative px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold font-mono tracking-widest text-sm rounded-lg border border-primary/50 transition-all overflow-hidden shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                 >
                     <span className="relative z-10 flex items-center justify-center gap-2"><Power className="w-4 h-4" /> ENGAGE</span>
                     <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                 </button>
             )}
         </div>
      </CardHeader>
      <CardContent className="p-6 space-y-8">
        
        {/* Tracked Assets */}
        <div className="space-y-3">
           <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-b border-border/50 pb-2">
               <Shield className="w-4 h-4" /> Active Hunting Ground
           </div>
           
           {isAutopilotOn ? (
               trackedAssets.length > 0 ? (
                 <div className="flex flex-wrap gap-2 pt-2">
                     {trackedAssets.map(asset => (
                         <Badge key={asset} variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono text-xs px-3 py-1 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                             {asset}
                         </Badge>
                     ))}
                 </div>
               ) : (
                 <div className="text-sm font-mono text-muted-foreground p-4 bg-muted/30 rounded-lg text-center animate-pulse border border-border/50">
                     Scanning markets for high-conviction setups...
                 </div>
               )
           ) : (
               <div className="text-sm font-mono text-muted-foreground italic pl-2 opacity-50">
                   Autopilot is offline. No assets are being tracked.
               </div>
           )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2 bg-muted/20 p-5 rounded-xl border border-primary/20 bg-primary/5 flex flex-col justify-center items-center text-center">
                <Shield className="h-6 w-6 text-primary mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Conviction Engine</span>
                <span className="text-sm font-bold text-foreground">Adaptive (AI)</span>
            </div>
            <div className="space-y-2 bg-muted/20 p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-center items-center text-center">
                <Activity className="h-6 w-6 text-amber-500 mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Dynamic Risk</span>
                <span className="text-sm font-bold text-foreground">Volatility-Based</span>
            </div>
            <div className="space-y-2 bg-muted/20 p-5 rounded-xl border border-destructive/20 bg-destructive/5 flex flex-col justify-center items-center text-center">
                <Activity className="h-6 w-6 text-destructive mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Portfolio Heat</span>
                <span className="text-sm font-bold text-foreground">Auto-Calibrated</span>
            </div>
            <div className="space-y-2 bg-muted/20 p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 flex flex-col justify-center items-center text-center">
                <Settings className="h-6 w-6 text-blue-500 mb-2" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Execution Algo</span>
                <span className="text-sm font-bold text-foreground">Urgency-Driven</span>
            </div>
        </div>

        <div className="rounded-xl border border-border/50 flex flex-col h-[280px] md:h-[350px] bg-background/50 shadow-inner overflow-hidden mt-6">
           <div className="bg-muted border-b border-border/50 p-3 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary" />
                <span className="font-bold text-foreground">EXEC_LOG // LIVE_FEED</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                <div className="w-2 h-2 rounded-full bg-primary" />
                STREAMING
              </div>
           </div>
           <ScrollArea className="flex-1 p-4 font-mono text-xs leading-relaxed">
               {logs.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50">
                       <Activity className="w-8 h-8 mb-2" />
                       <p>Awaiting operational output...</p>
                   </div>
               ) : (
                   <div className="space-y-3">
                        {logs.map((log, i) => (
                           <div key={i} className="flex flex-col md:flex-row gap-1 md:gap-3 hover:bg-muted/50 p-1.5 rounded transition-colors group">
                               <span className="text-muted-foreground/70 shrink-0 select-none">
                                 [{log.timestamp.toLocaleTimeString([], { hour12: false })}]
                               </span>
                               <div className="flex-1 break-words">
                                   <span className={log.symbol === 'SYSTEM' ? 'text-primary font-bold' : 'text-blue-500 font-bold'}>
                                       {log.symbol}
                                   </span>
                                   <span className="text-muted-foreground"> :: </span>
                                   <span className={log.symbol === 'SYSTEM' ? 'text-foreground font-medium flex-wrap' : 'text-foreground/80 flex-wrap'}>
                                       {log.message}
                                   </span>
                               </div>
                           </div>
                       ))}
                   </div>
               )}
           </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
