import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/Toast';
import { Play, X, Plus } from 'lucide-react';
import { useIndicatorStore } from '@/store/useIndicatorStore';
import debounce from 'lodash/debounce';

export const ExecutionSettings = () => {
  const [rules, setRules] = useState<any[]>([]);
  const { showToast } = useToast();
  const { configs, fetchConfigs } = useIndicatorStore();

  useEffect(() => {
    fetchRules();
    fetchConfigs();
  }, [fetchConfigs]);

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/settings/execution_config');
      const data = res.ok ? await res.json() : null;
      if (data && data.rules) {
        setRules(data.rules);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const syncRulesToBackend = useCallback(
    debounce(async (newRules: any[]) => {
      try {
        await fetch('/api/settings/execution_config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: newRules })
        });
        showToast('Execution rules saved', 'success');
      } catch (err) {
        showToast('Failed to save rules', 'error');
      }
    }, 500),
    []
  );

  const handleUpdateRule = (index: number, updates: any) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    setRules(updated);
    syncRulesToBackend(updated);
  };

  const handleAddRule = () => {
    const newRule = {
      id: `rule_${Date.now()}`,
      enabled: true,
      symbol: 'ALL',
      timeframe: '1m',
      action: 'LONG',
      logic_operator: 'AND',
      conditions: [
        {
          type: 'INDICATOR',
          key: 'rsi1',
          operator: 'LESS_THAN',
          value: 30
        }
      ]
    };
    const updated = [...rules, newRule];
    setRules(updated);
    syncRulesToBackend(updated);
  };

  const handleRemoveRule = (index: number) => {
    const updated = [...rules];
    updated.splice(index, 1);
    setRules(updated);
    syncRulesToBackend(updated);
  };

  const addCondition = (ruleIndex: number) => {
    const updated = rules.map((r, i) => {
      if (i === ruleIndex) {
        return {
          ...r,
          conditions: [
            ...(r.conditions || []),
            { type: 'INDICATOR', key: 'rsi1', operator: 'GREATER_THAN', value: 50 }
          ]
        };
      }
      return r;
    });
    setRules(updated);
    syncRulesToBackend(updated);
  };

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    const updated = rules.map((r, i) => {
      if (i === ruleIdx) {
        const newConds = [...(r.conditions || [])];
        newConds.splice(condIdx, 1);
        return { ...r, conditions: newConds };
      }
      return r;
    });
    setRules(updated);
    syncRulesToBackend(updated);
  };

  const updateCondition = (ruleIdx: number, condIdx: number, updates: any) => {
    const updated = rules.map((r, i) => {
      if (i === ruleIdx) {
        const newConds = [...(r.conditions || [])];
        newConds[condIdx] = { ...newConds[condIdx], ...updates };
        return { ...r, conditions: newConds };
      }
      return r;
    });
    setRules(updated);
    syncRulesToBackend(updated);
  };

  return (
    <Card className="col-span-1 border-border/50 bg-card/50 backdrop-blur-sm shadow-xl overflow-hidden relative">
      <CardHeader className="border-b border-border/50 pb-5 pt-6 bg-gradient-to-b from-card to-transparent">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
               <Play className="h-6 w-6" />
             </div>
             <div>
               <CardTitle className="text-xl font-black uppercase tracking-widest text-foreground">
                 Execution Rules Engine
               </CardTitle>
               <div className="text-xs font-mono text-muted-foreground mt-1 flex items-center gap-2">
                 Status: <span className="text-emerald-400 font-bold">ACTIVE ROUTING</span>
               </div>
             </div>
           </div>
           <Button variant="outline" size="sm" onClick={handleAddRule} className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground font-mono uppercase tracking-widest text-xs h-8">
            <Plus className="w-4 h-4 mr-1" /> Add Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar p-6">
        {rules.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center p-8 bg-muted/20 rounded-xl border border-border/50 border-dashed">No custom execution rules defined. Engine operating on standard MTF configurations.</div>
        ) : (
          rules.map((rule, idx) => (
            <div key={rule.id} className="p-3 border border-border/50 rounded-lg bg-background/50 space-y-3 relative group">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled !== false}
                    onCheckedChange={(c) => handleUpdateRule(idx, { enabled: c })}
                  />
                  <span className="text-xs font-bold">{rule.action} Rule</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="bg-background border border-input rounded p-1 text-xs"
                    value={rule.symbol || 'ALL'}
                    onChange={(e) => handleUpdateRule(idx, { symbol: e.target.value })}
                  >
                    <option value="ALL">All Assets</option>
                    <option value="BTCUSDT">BTCUSDT</option>
                    <option value="ETHUSDT">ETHUSDT</option>
                    <option value="SOLUSDT">SOLUSDT</option>
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRule(idx)} className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                <span className="text-muted-foreground font-bold shrink-0">EXECUTE</span>
                <select
                  className="bg-background border border-input rounded p-1 text-foreground"
                  value={rule.action}
                  onChange={(e) => handleUpdateRule(idx, { action: e.target.value })}
                >
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                  <option value="CLOSE_LONG">CLOSE LONG</option>
                  <option value="CLOSE_SHORT">CLOSE SHORT</option>
                </select>

                <span className="text-muted-foreground font-bold shrink-0 ml-2">ON</span>
                <select
                  className="bg-background border border-input rounded p-1 text-foreground"
                  value={rule.timeframe}
                  onChange={(e) => handleUpdateRule(idx, { timeframe: e.target.value })}
                >
                  <option value="1m">1m Context</option>
                  <option value="5m">5m Context</option>
                  <option value="15m">15m Context</option>
                  <option value="1h">1h Context</option>
                </select>

                 <span className="text-muted-foreground font-bold shrink-0 ml-2">WHEN</span>
                 <select
                  className="bg-background border border-input rounded p-1 text-foreground"
                  value={rule.logic_operator || 'AND'}
                  onChange={(e) => handleUpdateRule(idx, { logic_operator: e.target.value })}
                >
                  <option value="AND">ALL (AND)</option>
                  <option value="OR">ANY (OR)</option>
                </select>
              </div>

              <div className="space-y-2">
                {(rule.conditions || []).map((cond: any, cIdx: number) => (
                  <div key={cIdx} className="flex flex-wrap items-center gap-2 text-xs bg-muted/50 p-2 rounded relative border border-border/30">
                    <select
                      className="bg-background border border-input rounded p-1 text-foreground"
                      value={cond.type || 'INDICATOR'}
                      onChange={(e) => updateCondition(idx, cIdx, { type: e.target.value, key: '' })}
                    >
                      <option value="INDICATOR">Indicator</option>
                      <option value="MACRO">Macro</option>
                      <option value="VOLUME">Volume/Flow</option>
                    </select>

                    <select
                      className="bg-background border border-input rounded p-1 flex-1 text-foreground"
                      value={cond.key || ''}
                      onChange={(e) => updateCondition(idx, cIdx, { key: e.target.value })}
                    >
                      {cond.type === 'INDICATOR' && (
                        <>
                          <option value="">Select Indicator...</option>
                          {configs.filter(c => c.enabled).map(c => {
                            if (c.type === 'MACD') {
                              return (
                                <React.Fragment key={c.id}>
                                  <option value={`${c.id}.histogram`}>{c.id.toUpperCase()} Histogram</option>
                                  <option value={`${c.id}.macd`}>{c.id.toUpperCase()} MACD Line</option>
                                  <option value={`${c.id}.signal`}>{c.id.toUpperCase()} Signal Line</option>
                                </React.Fragment>
                              );
                            }
                            if (c.type === 'SUPERTREND') {
                              return (
                                <React.Fragment key={c.id}>
                                  <option value={`${c.id}.direction`}>{c.id.toUpperCase()} Direction</option>
                                  <option value={`${c.id}.supertrend`}>{c.id.toUpperCase()} Line</option>
                                </React.Fragment>
                              );
                            }
                            return <option key={c.id} value={c.id}>{c.id.toUpperCase()}</option>
                          })}
                          <option value="rsi1">RSI (Default)</option>
                          <option value="ema_14">EMA 14 (Default)</option>
                        </>
                      )}
                      
                      {cond.type === 'MACRO' && (
                        <>
                          <option value="">Select Macro Metric...</option>
                          <option value="regime">Regime (1=BULL, -1=BEAR, 0=CHOP)</option>
                          <option value="vix">VIX</option>
                          <option value="dxy">DXY Correlation</option>
                        </>
                      )}

                       {cond.type === 'VOLUME' && (
                        <>
                          <option value="">Select Volume Metric...</option>
                          <option value="cvd">CVD Delta</option>
                          <option value="buy_walls">Buy Walls</option>
                          <option value="sell_walls">Sell Walls</option>
                        </>
                      )}
                    </select>

                    <select
                      className="bg-background border border-input rounded p-1 text-foreground"
                      value={cond.operator}
                      onChange={(e) => updateCondition(idx, cIdx, { operator: e.target.value })}
                    >
                      <option value="GREATER_THAN">{'>'}</option>
                      <option value="LESS_THAN">{'<'}</option>
                      <option value="EQUALS">{'=='}</option>
                      <option value="CROSS_ABOVE">Crosses Above</option>
                      <option value="CROSS_BELOW">Crosses Below</option>
                    </select>

                    <input
                      type="number"
                      className="bg-background border border-input rounded p-1 w-16 text-center text-foreground"
                      value={cond.value || 0}
                      onChange={(e) => updateCondition(idx, cIdx, { value: parseFloat(e.target.value) })}
                    />
                    
                     <Button variant="ghost" size="icon" onClick={() => removeCondition(idx, cIdx)} className="h-5 w-5 text-muted-foreground hover:text-red-500 absolute -right-1 -top-1">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
               <Button variant="ghost" size="sm" onClick={() => addCondition(idx)} className="text-[10px] uppercase text-muted-foreground">
                  + Add Condition
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

