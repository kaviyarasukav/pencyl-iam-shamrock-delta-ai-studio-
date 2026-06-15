import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CVDVisualizerProps {
  cvdData: any;
}

export const CVDVisualizer = React.memo(({ cvdData }: CVDVisualizerProps) => {
  const cvd = cvdData?.cvd || 0;
  const lastDelta = cvdData?.last_delta || 0;

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 text-purple-500" />
          Orderflow Delta (CVD)
        </CardTitle>
        <CardDescription className="text-[10px]">Aggressive Buy vs Sell Pressure</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Cumulative Delta</p>
              <p className={cn(
                "text-3xl font-mono font-bold tracking-tighter", 
                cvd >= 0 ? "text-green-500" : "text-red-500"
              )}>
                {cvd > 0 ? '+' : ''}{cvd.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Session Range</p>
              <p className="text-xs font-mono">
                H: <span className="text-green-500">{(cvdData?.session_high || 0).toFixed(1)}</span> / 
                L: <span className="text-red-500">{(cvdData?.session_low || 0).toFixed(1)}</span>
              </p>
            </div>
          </div>

          {/* CVD Mini Chart / Visualizer */}
          <div className="h-32 w-full bg-muted/20 rounded-xl relative overflow-hidden flex flex-col items-center justify-center border border-muted/30 shadow-inner">
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <BarChart3 className="w-20 h-20" />
            </div>
            
            <div className="z-10 text-center space-y-2">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Last Trade Delta</p>
              <Badge 
                className={cn(
                  "font-mono text-lg px-4 py-1 shadow-lg", 
                  lastDelta >= 0 ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"
                )}
              >
                {lastDelta > 0 ? '+' : ''}{lastDelta.toFixed(3)}
              </Badge>
            </div>
            
            {/* Dynamic Background Glow based on CVD */}
            <div 
              className={cn(
                "absolute inset-0 transition-opacity duration-1000",
                cvd >= 0 ? "bg-green-500/10" : "bg-red-500/10"
              )}
            />
            
            {/* Progress bar style indicator for session position */}
            <div className="absolute bottom-0 left-0 h-1 bg-primary/30 w-full">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, Math.max(0, ((cvd - (cvdData?.session_low || 0)) / ((cvdData?.session_high || 1) - (cvdData?.session_low || 0))) * 100))}%` 
                }}
              />
            </div>
          </div>
          
          <div className="bg-muted/30 p-3 rounded-lg border border-muted/20">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-bold text-primary mr-1">ANALYSIS:</span>
              {cvd > 0 
                ? "Buyers are aggressive, hitting the Ask price. Potential bullish momentum if price follows delta." 
                : "Sellers are aggressive, hitting the Bid price. Potential bearish pressure detected."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CVDVisualizer.displayName = 'CVDVisualizer';
