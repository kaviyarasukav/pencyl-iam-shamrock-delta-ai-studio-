import React, { useEffect, useState, useCallback } from 'react';
import { useIndicatorStore } from '../../store/useIndicatorStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { X } from 'lucide-react';
import debounce from 'lodash/debounce';

export const IndicatorSettings: React.FC = () => {
  const { configs, updateConfig, saveConfigs, isSettingsOpen, toggleSettings, fetchConfigs } = useIndicatorStore();
  
  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // Use debounce for saving settings
  const debouncedSave = useCallback(
    debounce(() => {
      saveConfigs();
    }, 500),
    [saveConfigs]
  );

  const handleUpdate = (id: string, updates: any) => {
    updateConfig(id, updates);
    debouncedSave();
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-card border-border text-card-foreground shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold">Indicator Configuration</CardTitle>
          <Button variant="ghost" size="icon" onClick={toggleSettings}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {configs.map((config) => (
            <div key={config.id} className="space-y-4 p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{config.id.toUpperCase()} Settings</h3>
                <div className="flex items-center space-x-2">
                  <Label htmlFor={`${config.id}-enabled`} className="text-xs text-muted-foreground">Enabled</Label>
                  <Switch
                    id={`${config.id}-enabled`}
                    checked={config.enabled}
                    onCheckedChange={(checked) => handleUpdate(config.id, { enabled: checked })}
                  />
                </div>
              </div>

              {config.enabled && (
                <div className="space-y-3 pt-2">
                  {config.type === 'RSI' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-xs text-zinc-400 col-span-1">Length</Label>
                      <input
                        type="range"
                        min="2"
                        max="100"
                        value={config.length || 14}
                        onChange={(e) => handleUpdate(config.id, { length: parseInt(e.target.value) })}
                        className="col-span-2"
                      />
                      <span className="text-xs text-zinc-300 col-span-1">{config.length || 14}</span>
                    </div>
                  )}
                  
                  {config.type === 'EMA' && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-xs text-zinc-400 col-span-1">Length</Label>
                      <input
                        type="range"
                        min="2"
                        max="100"
                        value={config.length || 14}
                        onChange={(e) => handleUpdate(config.id, { length: parseInt(e.target.value) })}
                        className="col-span-2"
                      />
                      <span className="text-xs text-zinc-300 col-span-1">{config.length || 14}</span>
                    </div>
                  )}
                  
                  {config.type === 'MACD' && (
                    <>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-xs text-muted-foreground col-span-1">Fast</Label>
                        <input
                          type="range" min="2" max="50"
                          value={config.fast_length || 12}
                          onChange={(e) => handleUpdate(config.id, { fast_length: parseInt(e.target.value) })}
                          className="col-span-2"
                        />
                        <span className="text-xs text-foreground col-span-1">{config.fast_length || 12}</span>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-xs text-muted-foreground col-span-1">Slow</Label>
                        <input
                          type="range" min="2" max="100"
                          value={config.slow_length || 26}
                          onChange={(e) => handleUpdate(config.id, { slow_length: parseInt(e.target.value) })}
                          className="col-span-2"
                        />
                        <span className="text-xs text-foreground col-span-1">{config.slow_length || 26}</span>
                      </div>
                    </>
                  )}

                  {config.type === 'SMC' && (
                    <>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-foreground">Show Order Blocks (OB)</Label>
                        <Switch
                          checked={config.show_ob !== false}
                          onCheckedChange={(checked) => handleUpdate(config.id, { show_ob: checked })}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
