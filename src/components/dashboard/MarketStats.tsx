import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Leaf, BarChart3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TickerData } from '@/services/ExchangeService';

interface MarketStatsProps {
  ticker: TickerData | undefined;
  lastKline: any;
}

const formatPrice = (price: string | undefined) => {
  if (!price) return '0.00';
  const val = parseFloat(price);
  if (isNaN(val)) return '0.00';
  if (val > 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

const formatVolume = (vol: string | undefined) => {
  if (!vol) return '0.00';
  const val = parseFloat(vol);
  if (isNaN(val)) return '0.00';
  if (val > 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (val > 1000) return (val / 1000).toFixed(2) + 'K';
  return val.toFixed(2);
};

export const MarketStats = React.memo(({ ticker, lastKline }: MarketStatsProps) => {
  const isPositive = parseFloat(ticker?.priceChangePercent || '0') >= 0;
  const [priceFlash, setPriceFlash] = React.useState<'up' | 'down' | null>(null);
  const prevPrice = React.useRef(ticker?.lastPrice);

  React.useEffect(() => {
    if (ticker?.lastPrice && prevPrice.current && ticker.lastPrice !== prevPrice.current) {
      const direction = parseFloat(ticker.lastPrice) > parseFloat(prevPrice.current) ? 'up' : 'down';
      setPriceFlash(direction);
      const timer = setTimeout(() => setPriceFlash(null), 500);
      prevPrice.current = ticker.lastPrice;
      return () => clearTimeout(timer);
    }
    prevPrice.current = ticker?.lastPrice;
  }, [ticker?.lastPrice]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
      <Card className={cn(
        "bg-primary/5 border-primary/10 shadow-lg transition-colors duration-300",
        priceFlash === 'up' && "bg-green-500/10 border-green-500/30",
        priceFlash === 'down' && "bg-red-500/10 border-red-500/30"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Price</p>
            <DollarSign className={cn(
              "w-4 h-4 transition-colors",
              priceFlash === 'up' ? "text-green-500" : priceFlash === 'down' ? "text-red-500" : "text-primary"
            )} />
          </div>
          <div className="mt-2 min-w-0">
            <h3 className={cn(
              "text-3xl font-bold tracking-tighter transition-colors truncate",
              priceFlash === 'up' ? "text-green-500" : priceFlash === 'down' ? "text-red-500" : "text-foreground"
            )}>
              ${formatPrice(ticker?.lastPrice || '0')}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <p className={cn(
                "text-xs font-bold",
                isPositive ? "text-green-500" : "text-red-500"
              )}>
                {isPositive ? '+' : ''}{ticker?.priceChangePercent}%
              </p>
              {lastKline && (
                <Badge 
                  variant={lastKline.direction === 'buy' ? 'default' : 'destructive'}
                  className="text-[9px] h-4 px-1.5 font-bold uppercase"
                >
                  <Zap className="w-2 h-2 mr-1 fill-current" />
                  {lastKline.direction}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">24h Range</p>
            <Leaf className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">High</span>
              <span className="font-mono font-bold text-green-500 text-sm truncate">${formatPrice(ticker?.highPrice)}</span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden relative">
              {ticker?.highPrice && ticker?.lowPrice && ticker?.lastPrice && (
                <div 
                  className="absolute h-full bg-primary transition-all duration-500"
                  style={{ 
                    left: `${Math.max(0, Math.min(100, ((parseFloat(ticker.lastPrice) - parseFloat(ticker.lowPrice)) / (parseFloat(ticker.highPrice) - parseFloat(ticker.lowPrice))) * 100))}%`,
                    width: '4px',
                    transform: 'translateX(-50%)'
                  }}
                />
              )}
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">Low</span>
              <span className="font-mono font-bold text-red-500 text-sm truncate">${formatPrice(ticker?.lowPrice)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">24h Volume</p>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="mt-2 min-w-0">
            <h3 className="text-3xl font-bold tracking-tighter truncate">{formatVolume(ticker?.volume)}</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-wider truncate">Total Traded Units</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

MarketStats.displayName = 'MarketStats';
