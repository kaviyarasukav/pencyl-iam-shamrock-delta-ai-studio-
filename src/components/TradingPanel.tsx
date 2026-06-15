import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import { useToast } from './Toast';
import { useExchange } from '@/contexts/ExchangeContext';
import { OrderRequest } from '@/services/ExchangeService';

interface TradingPanelProps {
  symbol: string;
  currentPrice: string;
}

export default function TradingPanel({ symbol, currentPrice }: TradingPanelProps) {
  const { exchange, api, hasApiKeys } = useExchange();
  const { showToast } = useToast();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'LIMIT_CHASE' | 'TWAP'>('LIMIT_CHASE');
  const [price, setPrice] = useState<string>(currentPrice);
  const [quantity, setQuantity] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [twapDuration, setTwapDuration] = useState<string>('60'); // default 60 mins
  const [iceberg, setIceberg] = useState<boolean>(false);
  const [balances, setBalances] = useState<Record<string, { free: string, locked: string }>>({});
  const [loading, setLoading] = useState(false);
  const [postOnly, setPostOnly] = useState(false);
  const [isAutopilotOn, setIsAutopilotOn] = useState(false);

  // Fetch Autopilot state to lock out manual entries
  useEffect(() => {
    const fetchAutopilot = async () => {
      try {
        const res = await axios.get('/api/settings/autopilot');
        setIsAutopilotOn(res.data.isAutopilotOn || false);
      } catch (e) {}
    };
    fetchAutopilot();
    const interval = setInterval(fetchAutopilot, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Derived assets
  const quoteAsset = symbol.endsWith('USDT') ? 'USDT' : (symbol.endsWith('USDC') ? 'USDC' : (symbol.endsWith('BUSD') ? 'BUSD' : 'USDT'));
  const baseAsset = symbol.replace(quoteAsset, '');

  // Dynamic detection of settlement asset (USD/USDC/USDT)
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const data = await api.getPortfolio();
        const mappedBalances: Record<string, { free: string, locked: string }> = {};
        if (data && data.assets) {
          data.assets.forEach((asset: any) => {
            mappedBalances[asset.asset] = { free: asset.qty.toString(), locked: '0' };
          });
        }
        setBalances(mappedBalances);
      } catch (e) {}
    };
    fetchBalances();
    
    const es = new EventSource('/api/stream');
    es.addEventListener('balance', (e: any) => {
      try {
        const newBalances = JSON.parse(e.data);
        setBalances(newBalances);
      } catch (err) {}
    });

    const interval = setInterval(fetchBalances, 30000);
    return () => {
      clearInterval(interval);
      es.close();
    };
  }, [api]); // Only re-run if API service changes

  // Update price input when symbol changes or if it's empty
  React.useEffect(() => {
    setPrice(currentPrice);
    setQuantity('');
  }, [symbol]);

  // Also update if it's empty and we get a new currentPrice
  React.useEffect(() => {
    if (!price || price === '0') {
      setPrice(currentPrice);
    }
  }, [currentPrice]);

  // Handle order placement via exchange-specific API
  const handleOrder = async () => {
    if (((orderType === 'LIMIT' || orderType === 'LIMIT_CHASE' || orderType === 'TWAP') && !price) || !quantity) {
      showToast('Please enter required fields', 'error');
      return;
    }

    setLoading(true);

    try {
      const orderPayload: OrderRequest = {
        symbol,
        side,
        type: orderType as any, 
        quantity: parseFloat(quantity),
      };

      if (orderType === 'LIMIT' || orderType === 'LIMIT_CHASE' || orderType === 'TWAP') {
        orderPayload.price = parseFloat(price);
      }

      if (orderType === 'TWAP') {
        orderPayload.metadata = { ...orderPayload.metadata, duration_mins: parseInt(twapDuration) || 60 };
      }
      
      if (iceberg) {
        orderPayload.metadata = { ...orderPayload.metadata, icebergQty: (parseFloat(quantity) / 10).toFixed(4) };
      }

      if (takeProfit || stopLoss) {
        orderPayload.metadata = {
          ...orderPayload.metadata,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined
        };
      }

      if (postOnly && (orderType === 'LIMIT' || orderType === 'LIMIT_CHASE')) {
        orderPayload.timeInForce = 'GTX';
      }

      const response = await api.placeOrder(orderPayload);

      if (response.success) {
        showToast(`Order placed successfully! ID: ${response.orderId}`, 'success');
        setQuantity('');
      } else {
        showToast(`Failed: ${response.message || 'Unknown error'}`, 'error');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.details?.[0] || error.response?.data?.error || error.message;
      showToast(`Failed: ${errorMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full h-full border-none shadow-xl bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="flex justify-between items-center text-sm font-bold uppercase tracking-wider">
          <span>Execution Panel</span>
          <Badge variant="outline" className="font-mono bg-background/50">{symbol}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <Tabs defaultValue="BUY" onValueChange={(v) => setSide(v as 'BUY' | 'SELL')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger 
              value="BUY" 
              className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-500"
            >
              Buy
            </TabsTrigger>
            <TabsTrigger 
              value="SELL"
              className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500"
            >
              Sell
            </TabsTrigger>
          </TabsList>

          {/* Display available balance for the correct asset */}
          <div className="flex justify-between text-xs text-muted-foreground mb-4 px-1">
            <span>Available Balance:</span>
            <span className="font-mono font-medium text-foreground">
              {side === 'BUY' 
                ? `${balances[quoteAsset] ? (parseFloat(balances[quoteAsset].free) || 0).toFixed(2) : '0.00'} ${quoteAsset}` 
                : `${balances[baseAsset] ? (parseFloat(balances[baseAsset].free) || 0).toFixed(4) : '0.0000'} ${baseAsset}`}
            </span>
          </div>

          <Tabs defaultValue="LIMIT" onValueChange={(v) => setOrderType(v as any)} className="w-full mb-4">
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-1 bg-muted rounded-lg">
              <TabsTrigger value="LIMIT" className="text-[10px] sm:text-xs">Limit</TabsTrigger>
              <TabsTrigger value="MARKET" className="text-[10px] sm:text-xs">Market</TabsTrigger>
              <TabsTrigger value="LIMIT_CHASE" className="text-[10px] sm:text-xs">Chase</TabsTrigger>
              <TabsTrigger value="TWAP" className="text-[10px] sm:text-xs">TWAP</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            {(orderType === 'LIMIT' || orderType === 'LIMIT_CHASE' || orderType === 'TWAP') && (
              <div className="space-y-2">
                <Label htmlFor="price">Price ({quoteAsset}) {orderType === 'LIMIT_CHASE' ? '(Starting)' : ''}</Label>
                <Input 
                  id="price" 
                  type="number" 
                  placeholder="0.00" 
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="quantity">Quantity ({baseAsset})</Label>
                <button 
                  onClick={() => {
                    const asset = side === 'BUY' ? quoteAsset : baseAsset;
                    const balance = balances[asset]?.free || '0';
                    if (side === 'BUY') {
                      const parsedPrice = parseFloat(price);
                      if (!parsedPrice || parsedPrice <= 0) {
                        showToast('Please enter a valid price first', 'error');
                        return;
                      }
                      const maxQty = parseFloat(balance) / parsedPrice;
                      setQuantity((maxQty || 0).toFixed(4));
                    } else {
                      setQuantity(balance);
                    }
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  Max
                </button>
              </div>
              <Input 
                id="quantity" 
                type="number" 
                placeholder="0.00" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono"
              />
            </div>

            {orderType === 'TWAP' && (
              <div className="space-y-2">
                <Label htmlFor="twapDuration">Duration (Mins)</Label>
                <Input 
                  id="twapDuration" 
                  type="number" 
                  placeholder="60" 
                  value={twapDuration}
                  onChange={(e) => setTwapDuration(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="takeProfit" className="text-xs text-muted-foreground">Take Profit</Label>
                <Input 
                  id="takeProfit" 
                  type="number" 
                  placeholder="Optional" 
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stopLoss" className="text-xs text-muted-foreground">Stop Loss</Label>
                <Input 
                  id="stopLoss" 
                  type="number" 
                  placeholder="Optional" 
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Leverage/margin mode UI */}
            
            <div className="flex gap-4">
              {(orderType === 'LIMIT' || orderType === 'LIMIT_CHASE') && (
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="postOnly" 
                    checked={postOnly}
                    onChange={(e) => setPostOnly(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="postOnly" className="text-sm font-normal cursor-pointer">
                    Post Only
                  </Label>
                </div>
              )}
              {orderType !== 'MARKET' && (
                <div className="flex items-center space-x-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="iceberg" 
                    checked={iceberg}
                    onChange={(e) => setIceberg(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="iceberg" className="text-sm font-normal cursor-pointer text-blue-400">
                    Iceberg (10%)
                  </Label>
                </div>
              )}
            </div>

            <div className="pt-2 pb-4 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-mono font-medium">
                {(!isNaN(parseFloat(price)) && !isNaN(parseFloat(quantity))) ? (parseFloat(price) * parseFloat(quantity)).toFixed(2) : '0.00'} {quoteAsset}
              </span>
            </div>

            <Button 
              className={cn(
                "w-full font-bold",
                side === 'BUY' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white",
                (!hasApiKeys || isAutopilotOn) && "opacity-50 cursor-not-allowed"
              )}
              onClick={handleOrder}
              disabled={loading || !hasApiKeys || isAutopilotOn}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isAutopilotOn ? "LOCKED BY AUTOPILOT" : (hasApiKeys ? `${side === 'BUY' ? 'Buy' : 'Sell'} ${baseAsset}` : "API Keys Required")}
            </Button>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
