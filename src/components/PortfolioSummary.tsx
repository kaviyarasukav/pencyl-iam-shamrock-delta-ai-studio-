import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deltaService } from '@/services/delta';
import { useExchange } from '@/contexts/ExchangeContext';
import { Wallet, TrendingUp, PieChart, ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

export default function PortfolioSummary() {
  const { exchange, api } = useExchange();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async () => {
    try {
      const data = await api.getPortfolio();
      setPortfolio(data);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError(`API keys not configured. Please add Delta Exchange API keys in Settings to view your portfolio.`);
      } else {
        const msg = err.response?.data?.error || err.message || "Network Error";
        setError(`Failed to fetch portfolio: ${msg}`);
        console.error("Failed to fetch portfolio", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPortfolio();
    
    const es = new EventSource('/api/stream');
    
    es.addEventListener('balance', () => {
      // Refresh portfolio when balance updates are received from Delta Exchange
      fetchPortfolio();
    });

    const interval = setInterval(fetchPortfolio, 30000); // Fallback refresh every 30s
    
    return () => {
      clearInterval(interval);
      es.close();
    };
  }, [exchange]);

  if (error) {
    return (
      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm max-w-[250px]">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading || !portfolio || !Array.isArray(portfolio.assets)) return null;

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const chartData = portfolio.assets.map((asset: any) => ({
    name: asset.asset,
    value: asset.value
  }));

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          Portfolio Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Estimated Value</p>
              <h2 className="text-3xl font-bold tracking-tight">
                ${(portfolio?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  { 'USDT' }
                </span>
              </h2>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset Allocation</p>
              <div className="space-y-2">
                {portfolio.assets.slice(0, 4).map((asset: any, index: number) => (
                  <div key={asset.asset} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-medium">{asset.asset}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">${(asset.value || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{(((asset.value || 0) / (portfolio?.totalValue || 1)) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-[180px] relative">
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <RePieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ReTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <PieChart className="w-6 h-6 text-muted-foreground/50" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
