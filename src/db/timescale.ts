import { Pool } from 'pg';

export const isTimescaleConfigured = !!process.env.TIMESCALEDB_URL;

export const pool = new Pool({
  connectionString: process.env.TIMESCALEDB_URL || 'postgres://user:password@localhost:5432/quant_db',
  max: 20, // Max concurrent connections to timescale
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function initTimescaleDB() {
  if (!isTimescaleConfigured) {
    console.log('[TimescaleDB] Skipping initialization (TIMESCALEDB_URL not set).');
    return;
  }

  try {
    const client = await pool.connect();
    try {
      console.log('[TimescaleDB] Connected. Ensuring TimescaleDB extension and hypertables exist...');
      
      // Ensure the extension exists
      await client.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

      // 1. Tick Data
      await client.query(`
        CREATE TABLE IF NOT EXISTS tick_data (
          time TIMESTAMPTZ NOT NULL,
          symbol TEXT NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          quantity DOUBLE PRECISION NOT NULL,
          maker BOOLEAN NOT NULL
        );
      `);
      await client.query(`SELECT create_hypertable('tick_data', 'time', if_not_exists => TRUE);`);
      await client.query(`CREATE INDEX IF NOT EXISTS ix_symbol_time ON tick_data (symbol, time DESC);`);

      // 2. Order Flow Data (Depth)
      await client.query(`
        CREATE TABLE IF NOT EXISTS order_flow_data (
          time TIMESTAMPTZ NOT NULL,
          symbol TEXT NOT NULL,
          bid_price DOUBLE PRECISION,
          bid_qty DOUBLE PRECISION,
          ask_price DOUBLE PRECISION,
          ask_qty DOUBLE PRECISION,
          weighted_obi DOUBLE PRECISION
        );
      `);
      await client.query(`SELECT create_hypertable('order_flow_data', 'time', if_not_exists => TRUE);`);
      await client.query(`CREATE INDEX IF NOT EXISTS ix_of_symbol_time ON order_flow_data (symbol, time DESC);`);

      // 3. Trades (Performance Journal)
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          time TIMESTAMPTZ NOT NULL,
          internal_order_id TEXT,
          symbol TEXT NOT NULL,
          side TEXT NOT NULL,
          type TEXT NOT NULL,
          quantity DOUBLE PRECISION NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          status TEXT,
          macro_regime_state TEXT,
          is_shadow BOOLEAN DEFAULT FALSE
        );
      `);
      await client.query(`SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);`);
      try { await client.query('ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_shadow BOOLEAN DEFAULT FALSE;'); } catch (e) {}

      // 4. Signals
      await client.query(`
        CREATE TABLE IF NOT EXISTS signals (
          time TIMESTAMPTZ NOT NULL,
          signal_id TEXT,
          strategy_id TEXT,
          symbol TEXT NOT NULL,
          action TEXT NOT NULL,
          order_type TEXT,
          price DOUBLE PRECISION,
          weight DOUBLE PRECISION,
          metadata JSONB,
          session TEXT,
          is_shadow BOOLEAN DEFAULT FALSE
        );
      `);
      await client.query(`SELECT create_hypertable('signals', 'time', if_not_exists => TRUE);`);
      try { await client.query('ALTER TABLE signals ADD COLUMN IF NOT EXISTS is_shadow BOOLEAN DEFAULT FALSE;'); } catch (e) {}

      // 5. System Logs
      await client.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
          time TIMESTAMPTZ NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          macro_regime_state TEXT
        );
      `);
      await client.query(`SELECT create_hypertable('system_logs', 'time', if_not_exists => TRUE);`);

      // 6. Macro Snapshots
      await client.query(`
        CREATE TABLE IF NOT EXISTS macro_snapshots (
          time TIMESTAMPTZ NOT NULL,
          regime_state TEXT NOT NULL,
          killswitch_active BOOLEAN,
          dxy_price DOUBLE PRECISION,
          dxy_z_score DOUBLE PRECISION,
          yield_price DOUBLE PRECISION,
          yield_spread DOUBLE PRECISION,
          yield_z_score DOUBLE PRECISION,
          sentiment DOUBLE PRECISION,
          put_call_ratio DOUBLE PRECISION,
          implied_volatility DOUBLE PRECISION,
          cot_long_short_ratio DOUBLE PRECISION,
          funding_rate DOUBLE PRECISION,
          dxy_correlation DOUBLE PRECISION
        );
      `);
      await client.query(`SELECT create_hypertable('macro_snapshots', 'time', if_not_exists => TRUE);`);

      console.log('[TimescaleDB] Successfully initialized all schemas and hypertables.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[TimescaleDB] Initialization failed:', err);
  }
}

export async function insertTickBatch(ticks: any[]) {
  if (!isTimescaleConfigured || ticks.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO tick_data (time, symbol, price, quantity, maker) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const t of ticks) {
      if (!t.data || !t.data.p) continue;
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4})`);
      values.push(t.data.T || Date.now(), t.symbol, parseFloat(t.data.p), parseFloat(t.data.q), !!t.data.m);
      i += 5;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Tick insert failed:', e);
  } finally {
    if (client) client.release();
  }
}

export async function insertOrderFlowBatch(depths: any[]) {
  if (!isTimescaleConfigured || depths.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO order_flow_data (time, symbol, bid_price, bid_qty, ask_price, ask_qty, weighted_obi) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const d of depths) {
      if (!d.symbol) continue;
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6})`);
      
      let maxBidPrice = null;
      let maxBidQty = null;
      if (Array.isArray(d.bids) && d.bids.length > 0) {
        maxBidPrice = d.bids[0].p;
        maxBidQty = d.bids[0].q;
      } else if (d.bids && typeof d.bids === 'object' && !Array.isArray(d.bids)) {
        const keys = Object.keys(d.bids);
        if (keys.length > 0) {
          maxBidPrice = parseFloat(keys[keys.length - 1]);
          maxBidQty = d.bids[keys[keys.length - 1]];
        }
      }

      let maxAskPrice = null;
      let maxAskQty = null;
      if (Array.isArray(d.asks) && d.asks.length > 0) {
        maxAskPrice = d.asks[0].p;
        maxAskQty = d.asks[0].q;
      } else if (d.asks && typeof d.asks === 'object' && !Array.isArray(d.asks)) {
        const keys = Object.keys(d.asks);
        if (keys.length > 0) {
          maxAskPrice = parseFloat(keys[0]);
          maxAskQty = d.asks[keys[0]];
        }
      }

      values.push(d.timestamp || Date.now(), d.symbol, maxBidPrice, maxBidQty, maxAskPrice, maxAskQty, d.weighted_obi || null);
      i += 7;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Order flow insert failed:', e);
  } finally {
    if (client) client.release();
  }
}

export async function insertTradesBatch(trades: any[]) {
  if (!isTimescaleConfigured || trades.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO trades (time, internal_order_id, symbol, side, type, quantity, price, status, macro_regime_state, is_shadow) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const t of trades) {
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}, $${i+7}, $${i+8}, $${i+9})`);
      values.push(t.timestamp || Date.now(), t.internal_order_id, t.symbol, t.side, t.type, t.quantity, t.price, t.status, t.macro_regime_state, t.is_shadow ? true : false);
      i += 10;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Trades insert failed:', e);
  } finally {
    if (client) client.release();
  }
}

export async function insertSignalsBatch(signals: any[]) {
  if (!isTimescaleConfigured || signals.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO signals (time, signal_id, strategy_id, symbol, action, order_type, price, weight, metadata, session, is_shadow) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const s of signals) {
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}, $${i+7}, $${i+8}, $${i+9}, $${i+10})`);
      values.push(
        s.timestamp || Date.now(), 
        s.signal_id, 
        s.strategy_id, 
        s.symbol, 
        s.action, 
        s.order_type, 
        s.price, 
        s.weight, 
        typeof s.metadata === 'string' ? s.metadata : (s.metadata ? JSON.stringify(s.metadata) : null),
        s.session,
        s.is_shadow ? true : false
      );
      i += 11;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Signals insert failed:', e);
  } finally {
    if (client) client.release();
  }
}

export async function insertLogsBatch(logs: any[]) {
  if (!isTimescaleConfigured || logs.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO system_logs (time, level, message, metadata, macro_regime_state) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const l of logs) {
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4})`);
      values.push(l.timestamp || Date.now(), l.level, l.message, typeof l.metadata === 'string' ? l.metadata : (l.metadata ? JSON.stringify(l.metadata) : null), l.macro_regime_state);
      i += 5;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Logs insert failed:', e);
  } finally {
    if (client) client.release();
  }
}

export async function insertMacrosBatch(macros: any[]) {
  if (!isTimescaleConfigured || macros.length === 0) return;
  let client;
  try {
    client = await pool.connect();
    let query = 'INSERT INTO macro_snapshots (time, regime_state, killswitch_active, dxy_price, dxy_z_score, yield_price, yield_spread, yield_z_score, sentiment, put_call_ratio, implied_volatility, cot_long_short_ratio, funding_rate, dxy_correlation) VALUES ';
    const values: any[] = [];
    const chunks: string[] = [];
    let i = 1;
    for (const m of macros) {
      chunks.push(`(to_timestamp($${i} / 1000.0), $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}, $${i+7}, $${i+8}, $${i+9}, $${i+10}, $${i+11}, $${i+12}, $${i+13})`);
      values.push(
        m.timestamp || Date.now(), m.regime_state, !!m.killswitch_active,
        m.dxy_price, m.dxy_z_score, m.yield_price, m.yield_spread, m.yield_z_score,
        m.sentiment, m.put_call_ratio, m.implied_volatility, m.cot_long_short_ratio,
        m.funding_rate, m.dxy_correlation
      );
      i += 14;
    }
    if (chunks.length > 0) {
      await client.query(query + chunks.join(', ') + ' ON CONFLICT DO NOTHING', values);
    }
  } catch(e) {
    console.error('[TimescaleDB] Macros insert failed:', e);
  } finally {
    if (client) client.release();
  }
}
