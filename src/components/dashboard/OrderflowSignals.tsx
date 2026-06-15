import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, BarChart3, TrendingUp, Layers, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { formatDisplayPrice } from '@/lib/precision';
import { usePerformanceConfig } from '../../hooks/usePerformanceConfig';

interface OrderflowSignalsProps {
  symbol: string;
  trades: any[];
  volumeSpikes: any[];
  largeOrders: any[];
  liquidityShifts: any[];
  optionsFlow: any[];
  optionsSweeps: any[];
  gammaExposure: any[];
  icebergs: any[];
  spoofing: any[];
  strategySignals: any[];
}

export const OrderflowSignals = React.memo((props: OrderflowSignalsProps) => {
  const { isMobile, renderThrottleMs, maxListItems } = usePerformanceConfig();
  const [displayData, setDisplayData] = useState(props);
  const lastUpdateRef = useRef<number>(0);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Throttled update pattern for mobile performance
  useEffect(() => {
    if (!isMobile) {
      setDisplayData(props);
      return;
    }

    const now = Date.now();
    const timeSinceLast = now - lastUpdateRef.current;

    // Clear any existing pending update
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    if (timeSinceLast > renderThrottleMs) {
      // Allow immediate update if outside window
      setDisplayData(props);
      lastUpdateRef.current = now;
    } else {
      // Burst protection: Schedule a trailing update to ensure consistency
      const remaining = renderThrottleMs - timeSinceLast;
      throttleTimerRef.current = setTimeout(() => {
        setDisplayData(props);
        lastUpdateRef.current = Date.now();
        throttleTimerRef.current = null;
      }, remaining);
    }

    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, [props, isMobile, renderThrottleMs]);

  const { 
    symbol, 
    trades, 
    volumeSpikes, 
    largeOrders, 
    liquidityShifts, 
    optionsFlow,
    optionsSweeps,
    gammaExposure,
    icebergs,
    spoofing,
    strategySignals
  } = displayData;

  const baseAsset = symbol.replace('USDT', '');
  const [minUsdFilter, setMinUsdFilter] = useState<number>(50000);

  const filteredLargeOrders = largeOrders.filter(o => (o.usd_value || 0) >= minUsdFilter);
  const filteredLiquidityShifts = liquidityShifts.filter(s => (s.usd_value || 0) >= minUsdFilter);

  // Utility to slice lists based on performance config
  const limit = (list: any[]) => list.slice(0, maxListItems);

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <div className="flex items-center gap-2 bg-card/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border/50">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Min Value:</span>
          <select 
            className="bg-transparent text-xs font-mono font-bold outline-none cursor-pointer"
            value={minUsdFilter}
            onChange={(e) => setMinUsdFilter(Number(e.target.value))}
          >
            <option value={50000}>$50k</option>
            <option value={100000}>$100k</option>
            <option value={250000}>$250k</option>
            <option value={500000}>$500k</option>
            <option value={1000000}>$1M+</option>
          </select>
          {isMobile && (
            <Badge variant="outline" className="ml-2 text-[8px] uppercase border-orange-500/20 text-orange-500 animate-pulse">
              Throttled
            </Badge>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Whale Alerts */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4 text-blue-500" />
              Whale Alerts
            </CardTitle>
            <CardDescription className="text-[10px]">Unusual Volume Spikes</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {volumeSpikes.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No unusual volume</p>
                ) : (
                  limit(volumeSpikes).map((spike, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-between text-[11px]",
                        spike.side === 'BUY' ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">{spike.side === 'BUY' ? 'WHALE BUY' : 'WHALE SELL'}</span>
                        <span className="text-[9px] text-muted-foreground">{new Date(spike.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">{(spike.quantity || 0).toFixed(2)} {baseAsset}</p>
                        <p className="text-[9px] text-muted-foreground">Z-Score: {(spike.z_score || 0).toFixed(1)}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Massive Sweeps */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-purple-500">
              <Zap className="w-4 h-4" />
              Massive Sweeps
            </CardTitle>
            <CardDescription className="text-[10px]">Aggressive Institutional Buying</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {optionsSweeps.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No sweeps detected</p>
                ) : (
                  limit(optionsSweeps).map((sweep, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-2 rounded-lg border bg-purple-500/10 border-purple-500/20 flex flex-col gap-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-400">{sweep.option_type} SWEEP</span>
                        <span className="font-mono font-bold">${(sweep.usd_value / 1000).toFixed(0)}K</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>{sweep.expiry} @ ${sweep.strike}</span>
                        <span>{new Date().toLocaleTimeString()}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Dealer Gamma */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-orange-500">
              <TrendingUp className="w-4 h-4" />
              Dealer Gamma
            </CardTitle>
            <CardDescription className="text-[10px]">Hedging Feedback Loops</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {gammaExposure.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No gamma alerts</p>
                ) : (
                  limit(gammaExposure).map((gamma, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-2 rounded-lg border flex flex-col gap-1 text-[11px]",
                        gamma.estimated_hedge === 'BUY_UNDERLYING' ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{gamma.estimated_hedge}</span>
                        <span className="text-[9px] font-mono">{gamma.moneyness}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground leading-tight italic">
                        MM hedging {gamma.option_type} flow
                      </p>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Block Trades */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              Block Trades
            </CardTitle>
            <CardDescription className="text-[10px]">Orders &gt; ${(minUsdFilter / 1000).toFixed(0)}k USD</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {filteredLargeOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No block trades</p>
                ) : (
                  limit(filteredLargeOrders).map((order, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-between text-[11px]",
                        order.side === 'BUY' ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("font-bold", order.side === 'BUY' ? "text-green-500" : "text-red-500")}>
                          {order.side === 'BUY' ? 'BLOCK BUY' : 'BLOCK SELL'}
                        </span>
                        <span className="text-[9px] text-muted-foreground">{new Date(order.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">${((order.usd_value || 0) / 1000).toFixed(1)}K</p>
                        <p className="text-[9px] text-muted-foreground">{(order.quantity || 0).toFixed(2)} {baseAsset}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Iceberg Orders */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-500">
              <Layers className="w-4 h-4" />
              Iceberg Orders
            </CardTitle>
            <CardDescription className="text-[10px]">Hidden Institutional Liquidity</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {icebergs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No icebergs detected</p>
                ) : (
                  limit(icebergs).map((ice, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-2 rounded-lg border bg-cyan-500/10 border-cyan-500/20 flex flex-col gap-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-400">ICEBERG {ice.side}</span>
                        <span className="font-mono font-bold">${formatDisplayPrice(ice.price)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>Traded: {ice.total_traded.toFixed(2)}</span>
                        <span>Disp: {ice.displayed_qty.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Spoofing Alerts */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-red-500">
              <Filter className="w-4 h-4" />
              Spoofing Alerts
            </CardTitle>
            <CardDescription className="text-[10px]">Order Pulling & Stacking</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {spoofing.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No spoofing detected</p>
                ) : (
                  limit(spoofing).map((spoof, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-2 rounded-lg border flex flex-col gap-1 text-[11px]",
                        spoof.severity === 'HIGH' ? "bg-red-500/20 border-red-500/40" : "bg-red-500/10 border-red-500/20"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-400">{spoof.action}</span>
                        <Badge variant="outline" className="text-[8px] px-1 h-3 border-red-500/30 text-red-500">
                          {spoof.severity}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>{spoof.side} @ ${formatDisplayPrice(spoof.price)}</span>
                        <span>{new Date(spoof.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Confluence Signals */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm border-l-2 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-yellow-500">
              <Zap className="w-4 h-4" />
              Confluence Signals
            </CardTitle>
            <CardDescription className="text-[10px]">Multi-Dimensional Strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {strategySignals.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">Waiting for confluence...</p>
                ) : (
                  limit(strategySignals).map((sig, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-2 rounded-lg border bg-yellow-500/10 border-yellow-500/20 flex flex-col gap-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-yellow-500">{sig.direction} SIGNAL</span>
                        <span className="font-mono font-bold">${formatDisplayPrice(sig.trigger_price)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[9px] text-muted-foreground mt-1">
                        <div className="flex justify-between border-r border-border/30 pr-1">
                          <span>CVD Slope:</span>
                          <span className="text-green-500">+{sig.conditions_met?.cvd_slope}</span>
                        </div>
                        <div className="flex justify-between pl-1">
                          <span>Z-Score:</span>
                          <span className="text-primary">{sig.conditions_met?.z_score}</span>
                        </div>
                        <div className="flex justify-between border-r border-border/30 pr-1">
                          <span>Iceberg:</span>
                          <span className="text-cyan-500">{sig.conditions_met?.iceberg_distance}%</span>
                        </div>
                        <div className="flex justify-between pl-1">
                          <span>Call Sweep:</span>
                          <span className="text-purple-500">${((sig.conditions_met?.call_sweep_value || 0) / 1000).toFixed(0)}K</span>
                        </div>
                      </div>
                      <div className="text-[8px] text-muted-foreground/50 text-right mt-1">
                        {new Date(sig.timestamp).toLocaleTimeString()}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Liquidity Shifts */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <Layers className="w-4 h-4 text-blue-400" />
              Liquidity Shifts
            </CardTitle>
            <CardDescription className="text-[10px]">Book Changes &gt; ${(minUsdFilter / 1000).toFixed(0)}k</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {filteredLiquidityShifts.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No major shifts</p>
                ) : (
                  limit(filteredLiquidityShifts).map((shift, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-between text-[11px]",
                        shift.type === 'ADDED' ? "bg-blue-500/5 border-blue-500/10" : "bg-orange-500/5 border-orange-500/10"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("font-bold", shift.type === 'ADDED' ? "text-blue-400" : "text-orange-400")}>
                          {shift.side} {shift.type}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">${(shift.price || 0).toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">${((shift.usd_value || 0) / 1000).toFixed(1)}K</p>
                        <p className="text-[9px] text-muted-foreground">{new Date(shift.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Options Flow */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              Options Flow
            </CardTitle>
            <CardDescription className="text-[10px]">Massive Option Orders</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {optionsFlow.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No options flow</p>
                ) : (
                  limit(optionsFlow).map((flow, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-2 rounded-lg border flex items-center justify-between text-[11px]",
                        flow.type === 'CALL' ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className={cn("font-bold", flow.type === 'CALL' ? "text-green-500" : "text-red-500")}>
                          {flow.type} {flow.side}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-mono">
                          {flow.expiry} @ ${flow.strike}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">${((flow.usd_value || 0) / 1000).toFixed(1)}K</p>
                        <p className="text-[9px] text-muted-foreground">{new Date(flow.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-primary" />
              Tape
            </CardTitle>
            <CardDescription className="text-[10px]">Recent Market Trades</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-6 text-[10px] py-0">Price</TableHead>
                    <TableHead className="h-6 text-[10px] py-0 text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(trades) && limit(trades).map((t: any, i: number) => (
                    <TableRow key={i} className="border-b-muted/10 h-7">
                      <TableCell className={cn("font-mono text-[11px] py-1", t.isBuyerMaker ? "text-red-500" : "text-green-500")}>
                        {formatDisplayPrice(t.price)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] py-1 text-muted-foreground">
                        {(parseFloat(t.qty) || 0).toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

OrderflowSignals.displayName = 'OrderflowSignals';
