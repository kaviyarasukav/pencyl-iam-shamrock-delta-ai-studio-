import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { cn } from "@/lib/utils";
import { useMarketStore } from "../../store/useMarketStore";
import { useIndicatorStore } from "../../store/useIndicatorStore";

interface PriceChartSectionProps {
  symbol: string;
  klines: any[];
  resolution: string;
  onResolutionChange: (res: string) => void;
  macroState?: any;
}

export const PriceChartSection = React.memo(
  ({
    symbol,
    klines,
    resolution,
    onResolutionChange,
    macroState
  }: PriceChartSectionProps) => {
    const smcData = useMarketStore((s) => s.smcData);
    const configs = useIndicatorStore((s) => s.configs);
    const smcConfig = configs.find((c) => c.type === "SMC");

    const showOB = smcConfig?.enabled !== false && smcConfig?.show_ob !== false;
    const showVWAP = configs.find((c) => c.id === "vwap1")?.enabled !== false;
    const showEMA7 = configs.find((c) => c.id === "ema_7")?.enabled !== false;
    const showEMA25 = configs.find((c) => c.id === "ema_25")?.enabled !== false;
    const showRSI = configs.find((c) => c.id === "rsi1")?.enabled !== false;

    const filteredOBs = React.useMemo(() => {
      if (!smcData?.order_blocks || klines.length === 0) return [];
      const active = smcData.order_blocks.filter(
        (ob: any) => ob.status === "active",
      );
      const mitigated = smcData.order_blocks.filter(
        (ob: any) => ob.status === "mitigated",
      );
      // Sort and keep only the latest 5 mitigated order blocks for performance
      mitigated.sort((a: any, b: any) => (a.end_time || 0) - (b.end_time || 0));
      return [...active, ...mitigated.slice(-5)];
    }, [smcData?.order_blocks, klines.length]);

    const filteredFVGs = React.useMemo(() => {
      if (!smcData?.fvgs || klines.length === 0) return [];
      return smcData.fvgs.slice(-10); // Keep latest 10 FVGs
    }, [smcData?.fvgs, klines.length]);

    return (
      <Card className="border-none shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <span className="text-sm font-bold uppercase tracking-wider">
                Price Action (24h)
              </span>
              <div className="flex bg-background/50 p-0.5 rounded-lg border border-border/50">
                {["15m", "1h", "4h", "1d"].map((res) => (
                  <button
                    key={res}
                    onClick={() => onResolutionChange(res)}
                    className={cn(
                      "px-2 py-1 text-[10px] font-medium rounded-md transition-all",
                      resolution === res
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
            <Badge
              variant="secondary"
              className="font-mono self-end sm:self-auto"
            >
              {symbol}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[400px] w-full p-4">
            {klines.length > 0 ? (
              <div style={{ width: '100%', minHeight: 400 }}>
                <ResponsiveContainer width="100%" height={400} minWidth={1} minHeight={1}>
                  <LineChart data={klines} syncId="priceChart">
                    <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{
                      color: "hsl(var(--muted-foreground))",
                      marginBottom: "4px",
                    }}
                  />
                  {showVWAP && (
                    <Line
                      type="monotone"
                      dataKey="indicators.vwap1"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      activeDot={false}
                      dot={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                  {showEMA7 && (
                    <Line
                      type="monotone"
                      dataKey="indicators.ema_7"
                      stroke="#f59e0b"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  )}
                  {showEMA25 && (
                    <Line
                      type="monotone"
                      dataKey="indicators.ema_25"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      dot={false}
                      strokeDasharray="3 3"
                    />
                  )}

                  {macroState?.metrics?.gamma_flip_level > 0 && symbol.includes('BTC') && (
                    <ReferenceLine
                      y={macroState.metrics.gamma_flip_level}
                      stroke="#ec4899"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ position: "insideTopLeft", value: "Gamma Flip", fill: "#ec4899", fontSize: 10, fontWeight: "bold" }}
                    />
                  )}

                  {showOB &&
                    filteredFVGs.map((fvg: any, idx: number) => {
                      const formatTime = (ts: number) => {
                        if (
                          resolution === "1d" ||
                          resolution === "1w" ||
                          resolution === "1M"
                        ) {
                          return new Date(ts).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          });
                        }
                        return new Date(ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      };
                      return (
                        <React.Fragment key={`fvg-${fvg.id || idx}`}>
                          <ReferenceArea
                            {...({
                              x1: fvg.id && typeof fvg.id === 'string' && fvg.id.includes('_') ? formatTime(parseInt(fvg.id.split('_')[2]) || Date.now()) : formatTime(Date.now()),
                              x2: klines[klines.length-1].time, // stretch to end
                              y1: fvg.bottom_price,
                              y2: fvg.top_price,
                              fill:
                                fvg.direction === "BULLISH"
                                  ? "#34d399"
                                  : "#f87171",
                              fillOpacity: 0.15,
                              strokeOpacity: 0,
                            } as any)}
                          />
                        </React.Fragment>
                      );
                    })}

                  {showOB &&
                    filteredOBs.map((ob: any) => {
                      const formatTime = (ts: number) => {
                        if (
                          resolution === "1d" ||
                          resolution === "1w" ||
                          resolution === "1M"
                        ) {
                          return new Date(ts).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          });
                        }
                        return new Date(ts).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      };
                      return (
                        <React.Fragment key={ob.id}>
                          <ReferenceArea
                            {...({
                              x1: ob.start_time ? formatTime(ob.start_time) : formatTime(Date.now()),
                              x2: ob.end_time
                                ? formatTime(ob.end_time)
                                : undefined,
                              y1: ob.bottom_price,
                              y2: ob.top_price,
                              fill:
                                ob.direction === "BULLISH"
                                  ? "#10b981"
                                  : "#ef4444",
                              fillOpacity:
                                ob.status === "mitigated" ? 0.05 : 0.2,
                              strokeOpacity: 0,
                            } as any)}
                          />
                        </React.Fragment>
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                Loading chart data...
              </div>
            )}
          </div>

          {/* RSI Chart */}
          {showRSI && (
            <div className="h-[120px] w-full p-4 border-t border-border/50 bg-muted/5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Relative Strength Index (RSI 14)
              </p>
              {klines.length > 0 ? (
                <div style={{ width: '100%', minHeight: 100 }}>
                <ResponsiveContainer width="100%" height={100} minWidth={1} minHeight={1}>
                  <LineChart data={klines} syncId="priceChart">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--muted))"
                      vertical={false}
                    />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "10px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="indicators.rsi1"
                      stroke="#ec4899"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <ReferenceLine
                      y={70}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      strokeWidth={0.5}
                    />
                    <ReferenceLine
                      y={30}
                      stroke="#22c55e"
                      strokeDasharray="3 3"
                      strokeWidth={0.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

PriceChartSection.displayName = "PriceChartSection";
