import { broker, TOPICS } from '../../broker';
import { tickBuffer, depthBuffer } from './circular_buffer';
import { insertSignal, insertTrade, insertLog, insertMacroSnapshot, db } from './sqlite_journal';
import {
  initTimescaleDB,
  insertTickBatch,
  insertOrderFlowBatch,
  insertTradesBatch,
  insertSignalsBatch,
  insertLogsBatch,
  insertMacrosBatch,
  isTimescaleConfigured
} from './timescale';

let currentMacroRegime = 'INITIALIZING';

// Batch buffers
const logBatch: any[] = [];
const signalBatch: any[] = [];
const tradeBatch: any[] = [];
const macroBatch: any[] = [];

// Tick and depth buffers for timescale
const tickDataBatch: any[] = [];
const depthDataBatch: any[] = [];

// Transaction runners
const flushLogs = db.transaction((logs: any[]) => {
  for (const log of logs) insertLog.run(log);
});
const flushSignals = db.transaction((signals: any[]) => {
  for (const sig of signals) insertSignal.run(sig);
});
const flushTrades = db.transaction((trades: any[]) => {
  for (const trade of trades) insertTrade.run(trade);
});
const flushMacros = db.transaction((macros: any[]) => {
  for (const macro of macros) insertMacroSnapshot.run(macro);
});

// Periodic flush
setInterval(async () => {
  if (logBatch.length > 0) {
    const batch = logBatch.splice(0, logBatch.length);
    try { flushLogs(batch); } catch (e) { console.error('Flush log error:', e); }
    if (isTimescaleConfigured) await insertLogsBatch(batch);
  }
  if (signalBatch.length > 0) {
    const batch = signalBatch.splice(0, signalBatch.length);
    try { flushSignals(batch); } catch (e) { console.error('Flush signal error:', e); }
    if (isTimescaleConfigured) await insertSignalsBatch(batch);
  }
  if (tradeBatch.length > 0) {
    const batch = tradeBatch.splice(0, tradeBatch.length);
    try { flushTrades(batch); } catch (e) { console.error('Flush trade error:', e); }
    if (isTimescaleConfigured) await insertTradesBatch(batch);
  }
  if (macroBatch.length > 0) {
    const batch = macroBatch.splice(0, macroBatch.length);
    try { flushMacros(batch); } catch (e) { console.error('Flush macro error:', e); }
    if (isTimescaleConfigured) await insertMacrosBatch(batch);
  }
  if (tickDataBatch.length > 0) {
    const batch = tickDataBatch.splice(0, tickDataBatch.length);
    if (isTimescaleConfigured) await insertTickBatch(batch);
  }
  if (depthDataBatch.length > 0) {
    const batch = depthDataBatch.splice(0, depthDataBatch.length);
    if (isTimescaleConfigured) await insertOrderFlowBatch(batch);
  }
}, 500); // Batch writes every 500ms to avoid locking SQLite out

export function initializeDbLogger() {
  initTimescaleDB().catch(e => console.error(e));

  broker.subscribe(TOPICS.MARKET_DATA_TRADE, (msg) => {
    tickBuffer.push(msg);
    tickDataBatch.push(msg);
  });
  broker.subscribe(TOPICS.MARKET_DATA_DEPTH, (msg) => {
    depthBuffer.push(msg);
    depthDataBatch.push(msg);
  });

  broker.subscribe(TOPICS.STRATEGY_SIGNAL, (msg) => {
    signalBatch.push({
      signal_id: msg.signal_id || `sig_${Date.now()}`,
      timestamp: msg.timestamp || Date.now(),
      strategy_id: msg.strategy_id || 'UNKNOWN',
      symbol: msg.symbol || 'UNKNOWN',
      action: msg.action || 'UNKNOWN',
      order_type: msg.order_type || 'MARKET',
      price: msg.price !== undefined ? msg.price : null,
      weight: msg.weight !== undefined ? msg.weight : null,
      session: msg.metadata?.session || 'UNKNOWN',
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
      is_shadow: msg.isShadow ? 1 : 0
    });
    // Also add to system logs so it shows up in the frontend Journal!
    logBatch.push({
      timestamp: Date.now(),
      level: 'INFO',
      message: `[SIGNAL] ${msg.isShadow ? '(SHADOW) ' : ''}${msg.strategy_id} ${msg.action} ${msg.symbol} at ${msg.price || 'MKT'}`,
      metadata: null
    });
  });

  broker.subscribe(TOPICS.USER_ORDER_UPDATE, (msg) => {
    tradeBatch.push({
      internal_order_id: msg.c || msg.i?.toString() || 'unknown',
      symbol: msg.s || 'UNKNOWN',
      side: msg.S || 'UNKNOWN',
      type: msg.o || 'UNKNOWN',
      quantity: parseFloat(msg.q) || 0,
      price: parseFloat(msg.p) || 0,
      timestamp: msg.T || Date.now(),
      status: msg.X || 'UNKNOWN',
      macro_regime_state: currentMacroRegime || null,
      is_shadow: msg.isShadow ? 1 : 0
    });
    
    logBatch.push({
      timestamp: Date.now(),
      level: 'INFO',
      message: `[ORDER] ${msg.isShadow ? '(SHADOW) ' : ''}${msg.S || 'UNK'} ${msg.q || '0'} ${msg.s || 'UNK'} @ ${msg.p || 'MKT'} [${msg.X || 'UNK'}]`,
      metadata: null,
      macro_regime_state: currentMacroRegime || null
    });
  });

  const pushLog = (level: string, message: string, msg: any) => {
    logBatch.push({
      timestamp: msg?.timestamp || Date.now(),
      level: level || 'INFO', 
      message: message || '',
      metadata: msg ? JSON.stringify(msg) : null,
      macro_regime_state: currentMacroRegime || null
    });
  };

  broker.subscribe(TOPICS.VOLUME_SPIKE, (msg) => pushLog('INTEL', `[VOLUME SPIKE] ${msg.symbol} | Z-Score: ${msg.z_score?.toFixed(2) || 'N/A'} | Side: ${msg.side}`, msg));
  broker.subscribe(TOPICS.LARGE_ORDER_DETECTED, (msg) => pushLog('INTEL', `[LARGE ORDER] ${msg.symbol} | Value: $${msg.usd_value?.toLocaleString() || 'N/A'} | Side: ${msg.side}`, msg));
  broker.subscribe(TOPICS.LIQUIDITY_SHIFT, (msg) => pushLog('INTEL', `[LIQUIDITY] ${msg.symbol} | ${msg.type} $${msg.usd_value?.toLocaleString() || 'N/A'} on ${msg.side}`, msg));
  // CVD is too spammy for SQLite logs, only persist system events
  // broker.subscribe(TOPICS.CUMULATIVE_VOLUME_DELTA, (msg) => pushLog('INFO', `[CVD] ${msg.symbol} | CVD: ${msg.cvd?.toFixed(2) || 'N/A'} | Last Delta: ${msg.last_delta?.toFixed(2) || 'N/A'}`, msg));
  // broker.subscribe(TOPICS.USER_BALANCE_UPDATE, (msg) => pushLog('INFO', `[BALANCE] Balance updated for ${Object.keys(msg || {}).length} assets`, msg));
  broker.subscribe(TOPICS.EXECUTE_ORDER, (msg) => pushLog('INFO', `[EXECUTE] ${msg.symbol} | ${msg.side} ${msg.type} | Qty: ${msg.quantity} | Price: ${msg.price || 'MKT'}`, msg));
  broker.subscribe(TOPICS.MARKET_DATA_REQUEST, (msg) => pushLog('INFO', `[MD_REQ] Requested data for ${msg.symbol}`, msg));
  // broker.subscribe(TOPICS.OPTIONS_FLOW, (msg) => pushLog('INTEL', `[OPTIONS] ${msg.symbol} | ${msg.side} ${msg.type} | Strike: ${msg.strike} | Premium: $${msg.usd_value?.toLocaleString() || 'N/A'}`, msg));
  // broker.subscribe(TOPICS.ICEBERG_DETECTED, (msg) => pushLog('INTEL', `[ICEBERG] ${msg.symbol} | ${msg.side} | Price: ${msg.price} | Traded: ${msg.total_traded?.toFixed(2) || 'N/A'} | Displayed: ${msg.displayed_qty?.toFixed(2) || 'N/A'}`, msg));
  broker.subscribe(TOPICS.OPTIONS_SWEEP_DETECTED, (msg) => pushLog('INTEL', `[SWEEP] ${msg.message}`, msg));
  // broker.subscribe(TOPICS.GAMMA_EXPOSURE_ALERT, (msg) => pushLog('INTEL', `[GAMMA] ${msg.message}`, msg));

  broker.subscribe(TOPICS.SYSTEM_HEARTBEAT, (msg) => {
    if (msg.status !== 'OK') pushLog('ERROR', msg.message || 'Heartbeat failed or halted', msg);
  });

  broker.subscribe("ALPHA_SIGNAL", (msg: any) => {
    pushLog('INFO', `[ALPHA] ${msg.action ? msg.action : 'SIGNAL_DETECTED'} ${msg.symbol || msg.path || ''} ${msg.subtype || ''} ${msg.expected_yield ? 'Yield: ' + msg.expected_yield : ''}`, msg);
  });

  broker.subscribe(TOPICS.MACRO_REGIME_UPDATE, (msg) => {
    currentMacroRegime = msg.state;
    macroBatch.push({
      timestamp: msg.timestamp,
      regime_state: msg.state,
      killswitch_active: msg.killswitch_active ? 1 : 0,
      dxy_price: msg.metrics?.dxy_price !== undefined ? msg.metrics.dxy_price : null,
      dxy_z_score: msg.metrics?.dxy_z_score !== undefined ? msg.metrics.dxy_z_score : null,
      yield_price: msg.metrics?.yield_price !== undefined ? msg.metrics.yield_price : null,
      yield_spread: msg.metrics?.yield_spread !== undefined ? msg.metrics.yield_spread : null,
      yield_z_score: msg.metrics?.yield_z_score !== undefined ? msg.metrics.yield_z_score : null,
      sentiment: msg.metrics?.sentiment !== undefined ? msg.metrics.sentiment : null,
      put_call_ratio: msg.metrics?.put_call_ratio !== undefined ? msg.metrics.put_call_ratio : null,
      implied_volatility: msg.metrics?.implied_volatility !== undefined ? msg.metrics.implied_volatility : null,
      cot_long_short_ratio: msg.metrics?.cot_long_short_ratio !== undefined ? msg.metrics.cot_long_short_ratio : null,
      funding_rate: msg.metrics?.funding_rate !== undefined ? msg.metrics.funding_rate : null,
      dxy_correlation: msg.metrics?.dxy_correlation !== undefined ? msg.metrics.dxy_correlation : null
    });
    pushLog(msg.killswitch_active ? 'WARN' : 'INFO', `[MACRO] Regime: ${msg.state} | Killswitch: ${msg.killswitch_active} | Yield Z: ${msg.metrics?.yield_z_score?.toFixed(2) || 'N/A'} | Sentiment: ${msg.metrics?.sentiment?.toFixed(2) || 'N/A'}`, msg);
  });

  console.log('✅ Database Logger Initialized (SQLite Batch Mode + Circular Buffers)');
}
