import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Plus, X } from 'lucide-react';
import { useToast } from '@/components/Toast';

export const AssetRiskOverrides = () => {
  const [overrides, setOverrides] = useState<Record<string, { maxHeat: number, maxRisk: number }>>({});
  const [newSymbol, setNewSymbol] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetch('/api/settings/risk-overrides')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.overrides) {
          setOverrides(data.overrides);
        }
      })
      .catch(console.error);
  }, []);

  const saveOverrides = async (newOverrides: any) => {
    try {
      await fetch('/api/settings/risk-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: newOverrides })
      });
      showToast('Asset risk overrides saved');
    } catch (e) {
      showToast('Failed to save risk overrides', 'error');
    }
  };

  const handleAdd = () => {
    if (!newSymbol) return;
    const s = newSymbol.toUpperCase().trim();
    const updated = { ...overrides, [s]: { maxHeat: 5, maxRisk: 1 } };
    setOverrides(updated);
    saveOverrides(updated);
    setNewSymbol('');
  };

  const handleRemove = (symbol: string) => {
    const updated = { ...overrides };
    delete updated[symbol];
    setOverrides(updated);
    saveOverrides(updated);
  };

  const handleUpdate = (symbol: string, key: string, val: number) => {
    const updated = { ...overrides, [symbol]: { ...overrides[symbol], [key]: val } };
    setOverrides(updated);
    saveOverrides(updated);
  };

  return (
    <Card className="col-span-1 border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden relative">
      <CardHeader className="border-b border-border/50 pb-4 pt-5 bg-gradient-to-b from-card to-transparent">
        <div className="flex items-center gap-3 space-x-2">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Granular Asset Risk</CardTitle>
            <div className="text-[10px] text-muted-foreground uppercase opacity-80 mt-1">Override Global Risk Constraints For Specific Assets</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={newSymbol} 
            onChange={e => setNewSymbol(e.target.value)}
            placeholder="e.g. PEPEUSDT" 
            className="flex-1 bg-background border border-input rounded px-3 py-1 text-xs font-mono uppercase"
          />
          <Button onClick={handleAdd} size="sm" variant="outline" className="text-xs h-8"><Plus className="w-4 h-4 mr-1"/> Add</Button>
        </div>

        <div className="space-y-2">
          {Object.entries(overrides).map(([symbol, vals]: [string, any]) => (
             <div key={symbol} className="bg-background/50 border border-border/50 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4">
                 <div className="font-bold text-sm tracking-wider w-24">{symbol}</div>
                 <div className="flex items-center gap-2 flex-wrap flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Max Risk %</span>
                        <input 
                          type="number" 
                          value={vals.maxRisk} 
                          step="0.1"
                          onChange={e => handleUpdate(symbol, 'maxRisk', parseFloat(e.target.value))}
                          className="w-16 bg-muted border border-border/50 rounded px-2 py-1 text-xs text-center font-mono"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Max Heat %</span>
                        <input 
                          type="number" 
                          value={vals.maxHeat} 
                          step="0.1"
                          onChange={e => handleUpdate(symbol, 'maxHeat', parseFloat(e.target.value))}
                          className="w-16 bg-muted border border-border/50 rounded px-2 py-1 text-xs text-center font-mono"
                        />
                    </div>
                 </div>
                 <Button onClick={() => handleRemove(symbol)} size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-500"><X className="w-3 h-3"/></Button>
             </div>
          ))}
          {Object.keys(overrides).length === 0 && (
             <div className="text-xs text-center text-muted-foreground italic opacity-70 p-4">No localized overrides active. Symbol allocations will use global limits.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
