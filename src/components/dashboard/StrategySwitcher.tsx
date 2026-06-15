import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, Zap, Scale, Layers, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';

type StrategyType = 'SCALP' | 'SWING' | 'ARBITRAGE' | 'GRID' | 'PLAYBACK';

export const StrategySwitcher = () => {
  const [activeStrategies, setActiveStrategies] = useState<StrategyType[]>(['SCALP']);
  const { showToast } = useToast();

  React.useEffect(() => {
    fetch('/api/settings/mode')
      .then(r => r.ok ? r.json() : null)
      .then(d => { 
        if (d.mode) {
          setActiveStrategies(Array.isArray(d.mode) ? d.mode : [d.mode]);
        } 
      })
      .catch();
  }, []);

  const handleStrategyToggle = async (strategy: StrategyType) => {
    let newStrategies: StrategyType[];
    if (activeStrategies.includes(strategy)) {
      newStrategies = activeStrategies.filter(s => s !== strategy);
    } else {
      newStrategies = [...activeStrategies, strategy];
    }
    setActiveStrategies(newStrategies);
    updateBackend(newStrategies);
  };

  const handleClear = () => {
    setActiveStrategies([]);
    updateBackend([]);
  };

  const updateBackend = async (strategies: StrategyType[]) => {
    try {
      await fetch('/api/settings/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: strategies })
      });
      showToast(`Strategies updated`, 'success');
    } catch (err: any) {
      showToast('Failed to switch strategy', 'error');
    }
  };

  const strategies = [
    { id: 'SCALP', label: 'Scalp (HFT)', icon: Zap, desc: 'High frequency, tight stops' },
    { id: 'SWING', label: 'Swing', icon: Activity, desc: 'Trend following, wider stops' },
    { id: 'ARBITRAGE', label: 'Arbitrage', icon: Scale, desc: 'Spot-Futures statistical arb' },
    { id: 'GRID', label: 'Grid/Market Maker', icon: Layers, desc: 'Laddered limit orders' },
  ];

  const isPlayback = activeStrategies.includes('PLAYBACK');

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Strategy Switcher
        </CardTitle>
        <div className="flex items-center gap-3">
           <button
              onClick={() => handleStrategyToggle('PLAYBACK')}
              className={cn(
                 "text-xs font-bold px-2 py-1 rounded transition-colors",
                 isPlayback ? "bg-amber-500/20 text-amber-500 border border-amber-500/50" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              title="Toggle Playback / Backtesting mode"
           >
              {isPlayback ? '⏹ Stop Playback' : '▶ Start Playback'}
           </button>
           <button 
             onClick={handleClear}
             className="text-xs text-muted-foreground hover:text-red-400 transition-colors flex items-center gap-1"
             title="Clear all strategies"
           >
             <Trash2 className="w-3 h-3" /> Clear
           </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {strategies.map(s => {
            const Icon = s.icon;
            const isActive = activeStrategies.includes(s.id as StrategyType);
            return (
              <button
                key={s.id}
                onClick={() => handleStrategyToggle(s.id as StrategyType)}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all relative overflow-hidden group",
                  isActive 
                    ? "bg-primary/10 border-primary text-primary shadow-sm" 
                    : "bg-background/50 border-border/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 p-1 bg-primary rounded-bl-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-background animate-pulse" />
                  </div>
                )}
                <Icon className={cn("w-5 h-5 mb-2", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                <div className="text-xs font-bold uppercase tracking-wider">{s.label}</div>
                <div className="text-[9px] mt-1 opacity-80">{s.desc}</div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  );
};

