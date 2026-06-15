import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deltaService } from '@/services/delta';
import { useExchange } from '@/contexts/ExchangeContext';
import { Trash2, History, ListTodo, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './Toast';

interface OrderHistoryProps {
  symbol: string;
}

export default function OrderHistory({ symbol }: OrderHistoryProps) {
  const { exchange, api } = useExchange();
  const { showToast } = useToast();
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orders, trades] = await Promise.all([
        api.getOpenOrders(symbol).catch((err) => {
          if (err.response?.status === 401) throw err;
          return [];
        }),
        api.getMyTrades(symbol).catch((err) => {
          if (err.response?.status === 401) throw err;
          return [];
        })
      ]);

      setOpenOrders(Array.isArray(orders) ? orders : []);
      setTradeHistory(Array.isArray(trades) ? trades.sort((a: any, b: any) => b.time - a.time) : []);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError(`API keys not configured. Please add Delta Exchange API keys in Settings to view order history.`);
      } else {
        console.error("Failed to fetch order history", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    const es = new EventSource('/api/stream');
    
    es.addEventListener('order', () => {
      // Refresh orders when an order update is received from Delta Exchange
      fetchData();
    });

    const interval = setInterval(fetchData, 30000); // Fallback refresh every 30s
    
    return () => {
      clearInterval(interval);
      es.close();
    };
  }, [symbol, exchange]);

  const handleCancel = async (orderId: string | number) => {
    setCancellingId(orderId);
    try {
      await api.cancelOrder(symbol, orderId);
      showToast('Order cancelled successfully', 'success');
      await fetchData();
    } catch (error) {
      console.error("Failed to cancel order", error);
      showToast('Failed to cancel order', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <History className="w-5 h-5" />
          Order Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm max-w-[300px]">{error}</p>
          </div>
        ) : (
          <Tabs defaultValue="open" className="w-full">
            <TabsList className="flex w-full flex-col sm:grid sm:grid-cols-2 mb-4 h-auto gap-2 sm:gap-0 p-1 bg-transparent sm:bg-muted">
              <TabsTrigger value="open" className="flex w-full items-center justify-center gap-2 bg-muted sm:bg-transparent data-[state=active]:bg-background">
                <ListTodo className="w-4 h-4" />
                Open Orders ({openOrders.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex w-full items-center justify-center gap-2 bg-muted sm:bg-transparent data-[state=active]:bg-background">
                <History className="w-4 h-4" />
                Trade History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open">
              <div className="rounded-md border border-muted overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!Array.isArray(openOrders) || openOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No open orders for {symbol}
                        </TableCell>
                      </TableRow>
                    ) : (
                      openOrders.map((order) => (
                        <TableRow key={order.orderId}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.time).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.side === 'BUY' ? 'default' : 'destructive'} className={cn(
                              "text-[10px] px-1.5 py-0",
                              order.side === 'BUY' ? "bg-green-500/20 text-green-500 hover:bg-green-500/30" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                            )}>
                              {order.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">${(parseFloat(order.price) || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{(parseFloat(order.origQty) || 0).toFixed(4)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                              {order.status.toLowerCase().replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => handleCancel(order.orderId)}
                              disabled={cancellingId === order.orderId}
                            >
                              {cancellingId === order.orderId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="rounded-md border border-muted overflow-x-auto">
                <Table className="min-w-[500px]">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!Array.isArray(tradeHistory) || tradeHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No trade history for {symbol}
                        </TableCell>
                      </TableRow>
                    ) : (
                      tradeHistory.slice(0, 10).map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(trade.time).toLocaleDateString()} {new Date(trade.time).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-1.5 py-0",
                              trade.side === 'BUY' ? "border-green-500 text-green-500" : "border-red-500 text-red-500"
                            )}>
                              {trade.side}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">${(parseFloat(trade.price) || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{(parseFloat(trade.qty) || 0).toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            ${((parseFloat(trade.price) || 0) * (parseFloat(trade.qty) || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
