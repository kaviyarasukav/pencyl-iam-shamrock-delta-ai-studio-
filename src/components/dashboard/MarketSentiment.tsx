import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compass, Gauge, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketSentimentProps {
  score?: number; // -1 to 1
}

export const MarketSentiment = React.memo(({ score = 0 }: MarketSentimentProps) => {
  // Map -1..1 to 0..100
  const normalizedSentiment = Math.round(((score + 1) / 2) * 100);
  
  const getLabel = (val: number) => {
    if (val > 75) return { text: 'Extreme Greed', color: 'text-green-500' };
    if (val > 55) return { text: 'Greed', color: 'text-green-400' };
    if (val > 45) return { text: 'Neutral', color: 'text-muted-foreground' };
    if (val > 25) return { text: 'Fear', color: 'text-orange-500' };
    return { text: 'Extreme Fear', color: 'text-red-500' };
  };

  const label = getLabel(normalizedSentiment);

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <Compass className="w-4 h-4 text-orange-400" />
          Market Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative w-32 h-16 overflow-hidden">
            {/* Semicircle Gauge */}
            <div className="absolute top-0 left-0 w-32 h-32 border-[12px] border-muted rounded-full" />
            <div 
              className={cn("absolute top-0 left-0 w-32 h-32 border-[12px] rounded-full transition-all duration-1000", 
                normalizedSentiment > 55 ? "border-green-500" : normalizedSentiment < 45 ? "border-red-500" : "border-primary"
              )}
              style={{ 
                clipPath: 'inset(0 0 50% 0)',
                transform: `rotate(${(normalizedSentiment / 100) * 180 - 90}deg)`
              }}
            />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-background border-2 border-primary rounded-full z-10" />
          </div>
          
          <div className="text-center mt-2">
            <p className={cn("text-xl font-black uppercase tracking-tighter", label.color)}>
              {label.text}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Index: {normalizedSentiment}/100
            </p>
          </div>

          <div className="mt-4 w-full grid grid-cols-3 gap-1 px-2">
            <div className={cn("h-1 rounded-full", normalizedSentiment < 45 ? "bg-red-500" : "bg-red-500/20")} />
            <div className={cn("h-1 rounded-full", normalizedSentiment >= 45 && normalizedSentiment <= 55 ? "bg-orange-500" : "bg-orange-500/20")} />
            <div className={cn("h-1 rounded-full", normalizedSentiment > 55 ? "bg-green-500" : "bg-green-500/20")} />
          </div>
          
          <div className="mt-4 flex items-start gap-2 p-2 bg-muted/20 rounded-lg border border-muted/30 w-full">
            <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[9px] text-muted-foreground leading-tight">
              Sentiment is currently <span className={cn("font-bold text-foreground", label.color)}>{label.text}</span>. 
              {normalizedSentiment > 55 ? " Market participants are optimistic, but watch for over-extension." : 
               normalizedSentiment < 45 ? " Extreme pessimism detected. Potential capitulation zone." : 
               " Neutral conditions. Market is currently range-bound."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MarketSentiment.displayName = 'MarketSentiment';
