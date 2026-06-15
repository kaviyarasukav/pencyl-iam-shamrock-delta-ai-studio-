import { broker, TOPICS } from "../../broker";
import { globalCircuitBreaker } from "../circuit_breaker";
import { RiskManager } from "./risk_manager";
import { getCachedData } from "../../server/cache";
import { sendToQuantEngine } from "../../server";
import { ExecutionOrder } from "../../shared-contracts/types";
import Big from "big.js";
import {
  formatPrice,
  isValidNotional,
  formatQuantity,
  safeAdd,
  safeSub,
  safeMult,
} from "../lib/precision";
import {
  savePendingOCO,
  deletePendingOCO,
  getAllPendingOCOs,
  getAllAlgoStates,
  getSetting,
} from "../db/sqlite_journal";
import { algoExecutionManager } from "../execution_algorithms";

// Local state maintained via events (Decoupled Architecture)
let balances: Record<string, { free: string; locked: string }> = {};
const haltedSymbols = new Set<string>();

// Track pending OCOs waiting for primary order to fill
const pendingOCOs = new Map<
  string,
  {
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number | string;
    takeProfit: string;
    stopLoss: string;
    market?: string;
    isShadow?: boolean;
  }
>();

// Track active OCOs for Auto-Breakeven
const activeBreakevenTrackers = new Map<
  string,
  {
    symbol: string;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: string;
    side: "BUY" | "SELL"; // side of the OCO (opposite of entry)
    markerReached: boolean;
    isShadow: boolean;
  }
>();

export function initializeOrderRouter() {
  // 0. Hydrate pending OCOs from SQLite (Safety Net Recovery)
  try {
    const ocos = getAllPendingOCOs();
    for (const oco of ocos as any[]) {
      pendingOCOs.set(oco.parent_order_id, {
        symbol: oco.symbol,
        side: oco.side,
        quantity: oco.quantity,
        takeProfit: oco.take_profit.toString(),
        stopLoss: oco.stop_loss.toString(),
        isShadow: Boolean(oco.is_shadow),
      });
    }
    if (pendingOCOs.size > 0) {
      console.log(
        `[Order Router] Hydrated ${pendingOCOs.size} pending OCOs from SQLite.`,
      );
    }
  } catch (e) {
    console.error("[Order Router] Failed to hydrate pending OCOs:", e);
  }

  // 1. Keep local balances updated silently in the background
  broker.subscribe(TOPICS.USER_BALANCE_UPDATE, (newBalances) => {
    balances = newBalances;
  });

  // 1.5 Listen for Order Updates to trigger pending OCOs
  broker.subscribe(TOPICS.USER_ORDER_UPDATE, (report) => {
    // report.X is order status, report.c is clientOrderId
    if (report.X === "FILLED" && activeBreakevenTrackers.has(report.c)) {
      activeBreakevenTrackers.delete(report.c); // Clear tracker once the OCO itself fills
    } else if (
      (report.X === "CANCELED" ||
        report.X === "REJECTED" ||
        report.X === "EXPIRED") &&
      activeBreakevenTrackers.has(report.c)
    ) {
      activeBreakevenTrackers.delete(report.c);
    }

    if (report.X === "FILLED" && pendingOCOs.has(report.c)) {
      const ocoData = pendingOCOs.get(report.c)!;
      pendingOCOs.delete(report.c);
      deletePendingOCO.run(report.c); // Sync with DB

      // Dispatch OCO order to close the position
      const ocoOrder: ExecutionOrder = {
        internal_order_id: `oco_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        timestamp: Date.now(),
        symbol: ocoData.symbol,
        side: ocoData.side, // Already set to opposite side during initialization
        type: "OCO",
        quantity: report.z || report.q, // Use actual cumulative filled quantity string for absolute precision
        price: ocoData.takeProfit,
        stopPrice: ocoData.stopLoss,
        stopLimitPrice: ocoData.stopLoss,
        market: (ocoData.market || "SPOT") as "SPOT" | "FUTURES" | "OPTIONS",
        isShadow: ocoData.isShadow,
      };

      // Setup Auto-Breakeven Tracking
      const entryPrice = parseFloat(report.L || report.p || "0");
      if (entryPrice > 0) {
        activeBreakevenTrackers.set(ocoOrder.internal_order_id, {
          symbol: ocoData.symbol,
          entryPrice: entryPrice,
          stopLoss: parseFloat(ocoData.stopLoss),
          takeProfit: parseFloat(ocoData.takeProfit),
          quantity: String(report.z || report.q),
          side: ocoData.side,
          markerReached: false,
          isShadow: !!ocoData.isShadow,
        });
      }

      broker.publish(TOPICS.EXECUTE_ORDER, ocoOrder);
      console.log(
        `[Order Router] Primary order ${report.c} filled. Dispatched OCO:`,
        ocoOrder,
      );
    } else if (
      (report.X === "CANCELED" ||
        report.X === "REJECTED" ||
        report.X === "EXPIRED") &&
      pendingOCOs.has(report.c)
    ) {
      console.log(
        `[Order Router] Primary order ${report.c} was ${report.X}. Canceling pending OCO.`,
      );
      pendingOCOs.delete(report.c);
      deletePendingOCO.run(report.c); // Sync with DB
    }
  });

  // 1.7 Auto-Breakeven Monitor Engine
  setInterval(() => {
    if (activeBreakevenTrackers.size === 0) return;

    for (const [ocoId, tracker] of activeBreakevenTrackers.entries()) {
      if (tracker.markerReached) continue;

      const ticker = getCachedData(`ticker_${tracker.symbol}`, 2000) as any;
      if (!ticker || !ticker.lastPrice) continue;

      const currentPrice = parseFloat(ticker.lastPrice);
      const risk = Math.abs(tracker.entryPrice - tracker.stopLoss);
      if (risk <= 0) continue;

      // Ensure 1:1 risk/reward reached
      let reached1to1 = false;
      let breakevenPrice = tracker.entryPrice;

      // If OCO side is SELL, it means we are LONG.
      if (tracker.side === "SELL") {
        const targetPrice = tracker.entryPrice + risk;
        if (currentPrice >= targetPrice) {
          reached1to1 = true;
          breakevenPrice = tracker.entryPrice + risk * 0.05; // slightly above for fees
        }
      }
      // If OCO side is BUY, it means we are SHORT.
      else if (tracker.side === "BUY") {
        const targetPrice = tracker.entryPrice - risk;
        if (currentPrice <= targetPrice) {
          reached1to1 = true;
          breakevenPrice = tracker.entryPrice - risk * 0.05;
        }
      }

      if (reached1to1) {
        console.log(
          `[Order Router] 1:1 R/R reached for ${tracker.symbol}. Updating OCO ${ocoId} to breakeven.`,
        );
        tracker.markerReached = true;

        // Cancel old OCO
        broker.publish(TOPICS.EXECUTE_ORDER, {
          internal_order_id: `cancel_${ocoId}`,
          symbol: tracker.symbol,
          side: tracker.side,
          type: "CANCEL",
          clientOrderId: ocoId,
          isShadow: tracker.isShadow,
        } as any);

        // Dispatch new Breakeven OCO
        const exchangeInfo = getCachedData("exchangeInfo", 86400000) as any;
        let tickSize = "0.01";
        if (exchangeInfo) {
          const symInfo = exchangeInfo.symbols.find(
            (s: any) => s.symbol === tracker.symbol,
          );
          if (symInfo) {
            const pf = symInfo.filters.find(
              (f: any) => f.filterType === "PRICE_FILTER",
            );
            if (pf) tickSize = pf.tickSize;
          }
        }

        const newOcoId = `oco_be_${Date.now()}`;
        const newOcoOrder: ExecutionOrder = {
          internal_order_id: newOcoId,
          timestamp: Date.now(),
          symbol: tracker.symbol,
          side: tracker.side,
          type: "OCO",
          quantity: tracker.quantity,
          price: tracker.takeProfit.toString(),
          stopPrice: formatPrice(breakevenPrice, tickSize),
          stopLimitPrice: formatPrice(breakevenPrice, tickSize),
          market: "SPOT",
          isShadow: tracker.isShadow,
        };

        broker.publish(TOPICS.EXECUTE_ORDER, newOcoOrder);

        // Setup tracker for the new OCO (so we clean it up if it gets filled/canceled!)
        activeBreakevenTrackers.delete(ocoId);
        activeBreakevenTrackers.set(newOcoId, {
          ...tracker,
          stopLoss: breakevenPrice,
          markerReached: true, // already breakeven, no more updates
        });
      }
    }
  }, 1000);

  // 2. Listen for Strategy Signals
  broker.subscribe(TOPICS.STRATEGY_SIGNAL, (signal) => {
    try {
      if (signal.action === "HALT_ALL") {
        console.warn(`[Order Router] GLOBAL HALT TRIGGERED.`);
        // Halt all active configurations
        getAllAlgoStates().forEach((state) => {
          algoExecutionManager.cancelAlgo((state as any).internal_order_id);
        });

        haltedSymbols.add("GLOBAL");
        return;
      }

      if (signal.action === "HALT") {
        console.warn(
          `[Order Router] HALT command for ${signal.symbol}. All subsequent signals will be blocked.`,
        );
        haltedSymbols.add(signal.symbol);

        getAllAlgoStates().forEach((state) => {
          if ((state as any).symbol === signal.symbol) {
            algoExecutionManager.cancelAlgo((state as any).internal_order_id);
          }
        });
        return;
      }

      if (signal.action === "RESUME") {
        console.log(
          `[Order Router] RESUME command for ${signal.symbol}. Trading restored.`,
        );
        haltedSymbols.delete(signal.symbol);
        if (signal.symbol === "GLOBAL") haltedSymbols.delete("GLOBAL");
        return;
      }

      // Circuit Breaker check
      if (!globalCircuitBreaker.canTrade(signal.symbol)) {
        console.warn(`[Order Router] Signal blocked by Circuit Breaker (Slippage/Rate limit) for ${signal.symbol}`);
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "CIRCUIT_BREAKER_TRIPPED",
        });
        return;
      }

      // Memory Bridge check - instantly queries RAM without waiting for async Python events
      const globalKillswitch = getCachedData("global_killswitch", 10000);
      if (globalKillswitch === true || haltedSymbols.has("GLOBAL")) {
        console.warn(
          `[Order Router] Execution blocked via High-Speed Memory Bridge. Macro Killswitch is ACTIVE.`,
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "GLOBAL_KILLSWITCH_ACTIVE",
        });
        return;
      }

      if (haltedSymbols.has(signal.symbol)) {
        console.warn(
          `[Order Router] Blocked signal for ${signal.symbol} due to active HALT status.`,
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "SYMBOL_HALTED",
        });
        return;
      }

      // Temporal Killzone Logic (Only execute in NY or London Killzones)
      // NY AM: 09:30 - 11:00 EST | London: 03:00 - 05:00 EST
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [hourStr, minStr] = formatter.format(now).split(":");
      const timeNum = parseInt(hourStr) * 100 + parseInt(minStr);
      let inKillzone = false;
      if (timeNum >= 930 && timeNum <= 1100) inKillzone = true;
      if (timeNum >= 300 && timeNum <= 500) inKillzone = true;

      if (!inKillzone) {
        console.log(
          `[Order Router] Signal for ${signal.symbol} outside official Killzones (9:30-11:00 NY, 3:00-5:00 London). Executing anyway for testing/autopilot.`,
        );
        // sendToQuantEngine('SIGNAL_REJECTED', { symbol: signal.symbol, reason: 'OUTSIDE_KILLZONE' });
        // return;
      }

      // Step A: Get Exchange Rules (Phase 0 Cache)
      // Exchange info is cached for 24 hours (86400000 ms)
      const exchangeInfo = getCachedData("exchangeInfo", 86400000) as any;
      if (!exchangeInfo) {
        console.error(
          "[Order Router] No exchange info cached. Cannot process signal.",
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "NO_CACHE_EXCHANGE_INFO",
        });
        return;
      }

      const symbolInfo = exchangeInfo.symbols.find(
        (s: any) => s.symbol === signal.symbol,
      );
      if (!symbolInfo) {
        console.error(
          `[Order Router] Symbol ${signal.symbol} not found in exchange info.`,
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "INVALID_SYMBOL_IN_CACHE",
        });
        return;
      }

      const baseAsset = symbolInfo.baseAsset; // e.g., BTC
      const quoteAsset = symbolInfo.quoteAsset; // e.g., USDT

      // Extract Delta Exchange Filters
      const lotSizeFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === "LOT_SIZE",
      );
      const priceFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === "PRICE_FILTER",
      );
      const notionalFilter = symbolInfo.filters.find(
        (f: any) =>
          f.filterType === "NOTIONAL" || f.filterType === "MIN_NOTIONAL",
      );

      const stepSize = lotSizeFilter?.stepSize || "0.00001";
      const tickSize = priceFilter?.tickSize || "0.01";
      const minNotional =
        notionalFilter?.minNotional || notionalFilter?.notional || "5";

      // Step B: Determine Current Price & Apply Maker-Only Logic
      let currentPrice = signal.price;
      let depth = getCachedData(`depth_${signal.symbol}`, 1000) as any;

      if (!depth) {
        console.log(
          `[Order Router] No depth for ${signal.symbol}. Requesting stream...`,
        );
        broker.publish(TOPICS.MARKET_DATA_REQUEST, { symbol: signal.symbol });
        // Wait a bit for the stream to connect and provide data (optional, but safer to just fail this tick)
        // For now, we'll try to use the ticker as a fallback if depth is missing
        const ticker = getCachedData(`ticker_${signal.symbol}`, 5000) as any;
        if (ticker) {
          currentPrice = currentPrice || parseFloat(ticker.lastPrice);
        }
      }

      if (!currentPrice) {
        const isBuy =
          signal.action === "BUY" || signal.action === "CLOSE_SHORT";
        if (depth && depth.bids && depth.asks) {
          // If BUY: Use Ask price (what we pay) for conservative sizing
          // If SELL: Use Bid price (what we get) for conservative sizing
          currentPrice = isBuy ? depth.asks[0].p : depth.bids[0].p;
        } else {
          console.error("[Order Router] No price available for", signal.symbol);
          return;
        }
      }

      // Phase 1.5.2: Maker-Only (Post-Only) Enforcement
      if (signal.order_type === "LIMIT_MAKER") {
        if (
          !depth ||
          !depth.bids ||
          !depth.asks ||
          depth.bids.length === 0 ||
          depth.asks.length === 0
        ) {
          console.warn(
            `[Order Router] Cannot verify LIMIT_MAKER for ${signal.symbol} without depth data. Rejecting.`,
          );
          return;
        }

        const highestBid = depth.bids[0].p;
        const lowestAsk = depth.asks[0].p;
        const isBuy =
          signal.action === "BUY" || signal.action === "CLOSE_SHORT";

        // Use safe math from precision.ts to prevent floating point jitter
        if (isBuy && currentPrice >= lowestAsk) {
          const adjustedPrice = formatPrice(
            safeSub(lowestAsk, tickSize),
            tickSize,
          );
          console.log(
            `[Order Router] LIMIT_MAKER BUY price ${currentPrice} crosses spread (Ask: ${lowestAsk}). Adjusting to ${adjustedPrice}`,
          );
          currentPrice = adjustedPrice;
        } else if (!isBuy && currentPrice <= highestBid) {
          const adjustedPrice = formatPrice(
            safeAdd(highestBid, tickSize),
            tickSize,
          );
          console.log(
            `[Order Router] LIMIT_MAKER SELL price ${currentPrice} crosses spread (Bid: ${highestBid}). Adjusting to ${adjustedPrice}`,
          );
          currentPrice = adjustedPrice;
        }
      }

      // Step C: Apply Phase 1.1 Precision Engine
      const formattedPrice = formatPrice(currentPrice, tickSize);
      let finalQty = "0";

      // Step D: Apply Phase 1.2 Risk Manager
      if (
        signal.metadata &&
        signal.metadata.action === "SCALE_OUT" &&
        signal.metadata.scale_pct
      ) {
        // The Runner (Scaling OUT / Free-rolling): Sell % of full base position
        const baseBalance = balances[baseAsset]?.free || "0";
        const rawQty = new Big(baseBalance).times(signal.metadata.scale_pct);
        finalQty = formatQuantity(rawQty.toString(), stepSize);
        console.log(
          `[Order Router] The Runner: Scaling OUT ${signal.metadata.scale_pct * 100}% of ${baseBalance} -> ${finalQty} ${signal.symbol}`,
        );
      } else if (
        signal.action === "CLOSE_LONG" ||
        signal.action === "CLOSE_SHORT" ||
        (signal.action === "SELL" &&
          signal.metadata?.action === "CLOSE_POSITION")
      ) {
        if (signal.metadata?.requested_quantity) {
          finalQty = formatQuantity(
            signal.metadata.requested_quantity,
            stepSize,
          );
        } else {
          const baseBalance =
            balances[baseAsset]?.free || (signal.isShadow ? "10" : "0");
          const riskWeight = signal.weight !== undefined ? signal.weight : 100;
          finalQty = RiskManager.calculateSellQty(
            baseBalance,
            riskWeight,
            stepSize,
          );
        }
      } else if (signal.metadata && signal.metadata.requested_quantity) {
        // Manual trade with explicit quantity
        finalQty = formatQuantity(signal.metadata.requested_quantity, stepSize);
      } else if (signal.action === "BUY" || signal.action === "SELL") {
        // Phase 3 Zero-Input Execution & Dynamic Risk
        const totalEquityStr =
          balances[quoteAsset]?.free || (signal.isShadow ? "100000" : "0");
        const maxSpendable = new Big(totalEquityStr).times(
          new Big(1).sub(0.005),
        );
        const isBuyAction = signal.action === "BUY";

        const atr = signal.metadata?.atr
          ? parseFloat(signal.metadata.atr)
          : parseFloat(formattedPrice) * 0.005;
        const obBorders = signal.metadata?.ob_borders || [];

        if (!signal.metadata) signal.metadata = {};

        let dynamicStopLoss =
          signal.metadata.stop_loss || signal.stop_loss || 0;
        let dynamicTakeProfit =
          signal.metadata.take_profit || signal.take_profit || 0;

        if (!dynamicStopLoss || !dynamicTakeProfit) {
          if (isBuyAction) {
            const bullishBlocks = obBorders.filter(
              (ob: any) => ob.direction === "BULLISH" && ob.status === "active",
            );
            if (bullishBlocks.length > 0) {
              const nearestOB = bullishBlocks[bullishBlocks.length - 1]; // Assume last is nearest
              dynamicStopLoss = nearestOB.bottom - atr * 0.5; // Place SL just below OB with ATR buffer
            } else {
              dynamicStopLoss = parseFloat(formattedPrice) - atr * 2.5; // Fallback to Chandelier Exit
            }
            dynamicTakeProfit =
              parseFloat(formattedPrice) +
              (parseFloat(formattedPrice) - dynamicStopLoss) * 3; // 1:3 RR
          } else {
            // For shorts
            const bearishBlocks = obBorders.filter(
              (ob: any) => ob.direction === "BEARISH" && ob.status === "active",
            );
            if (bearishBlocks.length > 0) {
              const nearestOB = bearishBlocks[bearishBlocks.length - 1];
              dynamicStopLoss = nearestOB.top + atr * 0.5; // Place SL just above OB with ATR buffer
            } else {
              dynamicStopLoss = parseFloat(formattedPrice) + atr * 2.5;
            }
            dynamicTakeProfit =
              parseFloat(formattedPrice) -
              (dynamicStopLoss - parseFloat(formattedPrice)) * 3; // 1:3 RR
          }
        }

        let targetUsd = new Big(0);

        if (
          signal.position_size_usd &&
          parseFloat(signal.position_size_usd as any) > 0
        ) {
          targetUsd = new Big(signal.position_size_usd);
          console.log(
            `[Order Router] Using pre-calculated Risk Manager sizing from Engine: $${targetUsd.toFixed(2)}`,
          );
        } else if (
          signal.metadata?.position_size_usd &&
          parseFloat(signal.metadata.position_size_usd as any) > 0
        ) {
          targetUsd = new Big(signal.metadata.position_size_usd);
          console.log(
            `[Order Router] Using pre-calculated Risk Manager metadata sizing from Engine: $${targetUsd.toFixed(2)}`,
          );
        } else {
          // Read dynamic risk from settings, fallback to 2%
          const riskPerTradePct =
            parseFloat(getSetting("AUTOPILOT_MAX_RISK") || "2.0") / 100;
          const riskAmountUsd = maxSpendable.times(riskPerTradePct);

          const distanceToStopLoss = Math.abs(
            parseFloat(formattedPrice) - dynamicStopLoss,
          );
          const distanceToStopLossPct =
            distanceToStopLoss / (parseFloat(formattedPrice) || 1);

          if (distanceToStopLossPct > 0 && distanceToStopLossPct <= 0.15) {
            // Safety: avoid dividing by zero or massive stops (>15%)
            targetUsd = riskAmountUsd.div(distanceToStopLossPct);
          } else {
            targetUsd = maxSpendable.times(0.1); // Fallback to 10% of account
          }
        }

        if (targetUsd.gt(maxSpendable)) {
          console.warn(
            `[Order Router] Position size $${targetUsd.toString()} exceeds spendable. Capping risk.`,
          );
          targetUsd = maxSpendable;
        }

        const rawQty = targetUsd.div(new Big(formattedPrice));
        finalQty = formatQuantity(rawQty.toString(), stepSize);

        console.log(
          `[Order Router] Final Exec: Allocated $${targetUsd.toFixed(2)} (${finalQty} ${signal.symbol}). SL: ${dynamicStopLoss.toFixed(4)}, TP: ${dynamicTakeProfit.toFixed(4)}`,
        );

        signal.metadata.take_profit = dynamicTakeProfit;
        signal.metadata.stop_loss = dynamicStopLoss;
      } else if (signal.action === "HALT") {
        console.warn(
          "[Order Router] HALT signal received. Stopping execution.",
        );
        return;
      }

      // Step D.1: Check LOT_SIZE minQty
      const minQty = lotSizeFilter?.minQty || "0";
      if (parseFloat(finalQty) < parseFloat(minQty)) {
        console.warn(
          `[Order Router] Order for ${signal.symbol} rejected locally: Quantity ${finalQty} is below LOT_SIZE minQty of ${minQty}`,
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "BELOW_LOT_SIZE_MIN_QTY",
        });
        return;
      }

      // Step E: Apply MIN_NOTIONAL Regulation
      // For MARKET orders, use the determined price as an estimate for notional check
      if (!isValidNotional(formattedPrice, finalQty, minNotional)) {
        console.warn(
          `[Order Router] Order for ${signal.symbol} rejected locally: Notional value (~$${(parseFloat(formattedPrice) * parseFloat(finalQty)).toFixed(2)}) does not meet MIN_NOTIONAL of $${minNotional}`,
        );
        sendToQuantEngine("SIGNAL_REJECTED", {
          symbol: signal.symbol,
          reason: "BELOW_MIN_NOTIONAL",
        });
        return;
      }

      // Step F: Execute single or laddered orders (Grid & Ladder - Phase 5.3)
      const ladderSteps = signal.metadata?.ladder_steps
        ? parseInt(signal.metadata.ladder_steps)
        : 1;
      const ladderStepPct = signal.metadata?.ladder_step_pct
        ? parseFloat(signal.metadata.ladder_step_pct)
        : 0.005; // Default 0.5%

      const ordersToExecute: {
        order: ExecutionOrder;
        basePrice: number | string;
      }[] = [];

      if (ladderSteps > 1) {
        const isBuyAction =
          signal.action === "BUY" || signal.action === "CLOSE_SHORT";
        const baseQtyPerStep = parseFloat(finalQty) / ladderSteps;
        let accumulatedQty = 0;

        for (let i = 0; i < ladderSteps; i++) {
          const iterationPrice = isBuyAction
            ? safeMult(
                parseFloat(formattedPrice),
                safeSub(1, i * ladderStepPct),
              )
            : safeMult(
                parseFloat(formattedPrice),
                safeAdd(1, i * ladderStepPct),
              );

          let iterationQtyNum = baseQtyPerStep;
          if (i === ladderSteps - 1) {
            iterationQtyNum = parseFloat(finalQty) - accumulatedQty; // fix dust
          }
          accumulatedQty += iterationQtyNum;

          const iterationQtyStr = formatQuantity(iterationQtyNum, stepSize);
          const iterationPriceStr = formatPrice(iterationPrice, tickSize);

          if (parseFloat(iterationQtyStr) < parseFloat(minQty)) {
            console.warn(
              `[Order Router] Ladder step ${i + 1} qty below MIN_QTY. Skipping.`,
            );
            continue;
          }
          if (
            !isValidNotional(iterationPriceStr, iterationQtyStr, minNotional)
          ) {
            console.warn(
              `[Order Router] Ladder step ${i + 1} notional below MIN_NOTIONAL. Skipping.`,
            );
            continue;
          }

          ordersToExecute.push({
            basePrice: iterationPrice,
            order: {
              internal_order_id: `ord_${Date.now()}_ladder${i + 1}_${Math.floor(Math.random() * 1000)}`,
              timestamp: Date.now(),
              symbol: signal.symbol,
              side: isBuyAction ? "BUY" : "SELL",
              type: "LIMIT", // Ladder implies LIMIT entries
              quantity: iterationQtyStr,
              price: iterationPriceStr,
              timeInForce: signal.timeInForce || "GTC",
              market: signal.metadata?.market || "SPOT", // Forward market explicitly
              metadata: {
                action: signal.action,
                strategy_id: signal.strategy_id,
                ladder_step: i + 1,
              },
              isShadow: signal.isShadow,
            },
          });
        }
      } else {
        const notionalEstimate =
          parseFloat(formattedPrice) * parseFloat(finalQty);
        let algo: "TWAP" | "VWAP" | "PEG_BBO" | undefined;
        let durationMs: number | undefined;
        let sliceCount: number | undefined;
        let urgency: "LOW" | "MEDIUM" | "HIGH" | undefined;
        let maxRetries: number | undefined;

        if (signal.order_type === "MARKET") {
          if (notionalEstimate > 20000) {
            algo = "VWAP";
            durationMs = 120000;
            urgency = "MEDIUM";
            console.log(
              `[Order Router] Upgrading large MARKET order (${notionalEstimate}$) to VWAP.`,
            );
          } else if (notionalEstimate > 5000) {
            algo = "TWAP";
            durationMs = 60000;
            sliceCount = 5;
            console.log(
              `[Order Router] Upgrading large MARKET order (${notionalEstimate}$) to TWAP.`,
            );
          }
        } else if (signal.order_type === "TWAP") {
          algo = "TWAP";
          durationMs = signal.metadata?.duration_mins
            ? signal.metadata.duration_mins * 60000
            : 3600000;
          sliceCount = 10;
          console.log(
            `[Order Router] Manual TWAP requested. durationMs: ${durationMs}`,
          );
        } else if (signal.order_type === "LIMIT_CHASE") {
          algo = "PEG_BBO";
          maxRetries = 20;
          console.log(`[Order Router] LIMIT_CHASE requested. Using PEG_BBO.`);
        }

        ordersToExecute.push({
          basePrice: parseFloat(formattedPrice),
          order: {
            internal_order_id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            timestamp: Date.now(),
            symbol: signal.symbol,
            side:
              signal.action === "BUY" || signal.action === "CLOSE_SHORT"
                ? "BUY"
                : "SELL",
            type: (signal.order_type &&
            signal.order_type.toUpperCase() === "LIMIT_CHASE"
              ? "LIMIT"
              : signal.order_type && signal.order_type.toUpperCase() === "TWAP"
                ? "MARKET"
                : (signal.order_type || "MARKET").toUpperCase()) as any,
            quantity: finalQty,
            totalQuantity: finalQty,
            algo,
            durationMs,
            sliceCount,
            urgency,
            maxRetries,
            price:
              signal.order_type &&
              (signal.order_type.includes("LIMIT") ||
                signal.order_type === "OCO")
                ? formattedPrice
                : undefined,
            stopPrice: signal.stopPrice
              ? formatPrice(signal.stopPrice, tickSize)
              : undefined,
            timeInForce: signal.timeInForce,
            icebergQty:
              signal.icebergQty || signal.metadata?.icebergQty
                ? formatQuantity(
                    signal.icebergQty || signal.metadata.icebergQty,
                    stepSize,
                  )
                : undefined,
            market: signal.metadata?.market || "SPOT", // Forward market explicitly
            metadata: {
              action: signal.action,
              strategy_id: signal.strategy_id,
            },
            isShadow: signal.isShadow,
          },
        });
      }

      // Step G: Publish & Route OCOs for all generated orders
      // Extract Volatility-Adjusted Stops dynamically calculated by Python Engine (Chandelier Exit / ATR)
      let takeProfit =
        signal.metadata?.take_profit || signal.metadata?.takeProfit;
      let stopLoss = signal.metadata?.stop_loss || signal.metadata?.stopLoss;
      const isBuyAction =
        signal.action === "BUY" || signal.action === "CLOSE_SHORT";

      ordersToExecute.forEach((executionEntry) => {
        const { order, basePrice } = executionEntry;

        if (order.algo) {
          algoExecutionManager.dispatch(order);
          console.log(
            `[Order Router] Signal delegated to Algo Execution Engine (${order.algo}):`,
            order,
          );
        } else {
          broker.publish(TOPICS.EXECUTE_ORDER, order);
          console.log(
            `[Order Router] Signal converted to Execution Order:`,
            order,
          );
        }
      });
    } catch (e) {
      console.error("[Order Router] Error processing signal:", e);
    }
  });

  // 3. Listen for UPDATE_RISK signals
  broker.subscribe("UPDATE_RISK", (update) => {
    try {
      if (update.action === "HALT" || typeof update !== "object") return;

      const symbol = update.symbol;
      const newSl = update.new_sl;
      if (!symbol || !newSl) return;

      console.log(
        `[Order Router] UPDATE_RISK for ${symbol}. New SL: ${newSl}. Modifying pending OCOs...`,
      );

      // Update local pending OCOs
      for (const [ocoId, ocoData] of pendingOCOs.entries()) {
        if (ocoData.symbol === symbol) {
          ocoData.stopLoss = newSl.toString();
          // also save to DB
          savePendingOCO.run({
            parent_order_id: ocoId,
            symbol: ocoData.symbol,
            side: ocoData.side,
            quantity: ocoData.quantity,
            take_profit: ocoData.takeProfit,
            stop_loss: newSl.toString(),
            is_shadow: ocoData.isShadow ? 1 : 0,
            timestamp: Date.now(),
          });
        }
      }
    } catch (e) {
      console.error("[Order Router] Error processing UPDATE_RISK:", e);
    }
  });

  console.log("✅ Order Router Initialized (Signal -> Risk -> Execution)");
}
