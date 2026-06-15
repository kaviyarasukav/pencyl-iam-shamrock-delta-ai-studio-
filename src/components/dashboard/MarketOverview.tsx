import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, BarChart3, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { TickerData } from '@/services/ExchangeService';

interface MarketOverviewProps {
  tickers: TickerData[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

const formatPrice = (price: string | undefined) => {
  if (!price) return '0.00';
  const val = parseFloat(price);
  if (isNaN(val)) return '0.00';
  if (val > 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

export const MarketOverview = React.memo(({ tickers, selectedSymbol, onSelectSymbol }: MarketOverviewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [heatPct, setHeatPct] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchPortfolio = async () => {
      try {
        const res = await fetch('/api/wallet-summary');
        if (!res.ok) return;
        const data = await res.json();
        if (data.assets && data.totalValue) {
          const totalUsdt = data.assets.find((a: any) => a.asset === 'USDT' || a.asset === 'USDC' || a.asset === 'FDUSD');
          const safeValue = totalUsdt ? totalUsdt.value : 0;
          const riskValue = data.totalValue - safeValue;
          const pct = Math.max(0, Math.min(100, (riskValue / data.totalValue) * 100));
          if (active) setHeatPct(pct);
        }
      } catch (err) {}
    };

    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const filteredTickers = useMemo(() => tickers.filter(t => 
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  ), [tickers, searchTerm]);

  return (
    <Card className="lg:col-span-1 border-none shadow-xl bg-card/50 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="flex-none pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Market Overview
          </div>
        </CardTitle>
        <CardDescription>Top USDT trading pairs</CardDescription>

        <div className="mt-4 mb-2 space-y-1">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground items-center">
             <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-red-500" /> System Heat</span>
             <span>{heatPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-secondary overflow-hidden rounded-full">
            <div 
              className={cn("h-full transition-all duration-500", heatPct > 75 ? 'bg-red-500' : heatPct > 50 ? 'bg-orange-500' : heatPct > 25 ? 'bg-yellow-500' : 'bg-green-500')} 
              style={{ width: `${heatPct}%` }}
            />
          </div>
        </div>

        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search coin..."
            className="pl-8 bg-background/50"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-[250px] lg:h-[350px] xl:h-[440px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">Symbol</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">24h %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filteredTickers.map((ticker) => {
                  const isPositive = parseFloat(ticker.priceChangePercent) >= 0;
                  const isUSDT = ticker.symbol.endsWith('USDT');
                  const isUSDC = ticker.symbol.endsWith('USDC');
                  const isUSD = ticker.symbol.endsWith('USD') && !isUSDT && !isUSDC;
                  
                  const baseAsset = ticker.symbol.replace(/USDT|USDC|USD$/, '').replace(/_/, '');
                  let quoteAsset = 'USDT';
                  if (isUSDC) quoteAsset = 'USDC';
                  else if (isUSD) quoteAsset = 'USD';
                  
                  return (
                    <motion.tr
                      key={ticker.symbol}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => onSelectSymbol(ticker.symbol)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/50 group",
                        selectedSymbol === ticker.symbol && "bg-muted"
                      )}
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{baseAsset}</span>
                          <span className="text-[10px] text-muted-foreground">/{quoteAsset}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${formatPrice(ticker.lastPrice)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-medium",
                        isPositive ? "text-green-500" : "text-red-500"
                      )}>
                        <div className="flex items-center justify-end gap-1">
                          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {ticker.priceChangePercent}%
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

MarketOverview.displayName = 'MarketOverview';
