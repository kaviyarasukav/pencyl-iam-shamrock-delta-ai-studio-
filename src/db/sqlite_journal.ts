import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'shamrock_journal.db');

let _db: Database.Database;
try {
  _db = new Database(dbPath);
  // Optional lightweight check
  _db.pragma('journal_mode = WAL');
} catch (error) {
  console.error("CRITICAL: Database is corrupt or locked! Archiving and starting fresh.", error);
  const backupName = dbPath + `.corrupt_${Date.now()}`;
  try { fs.renameSync(dbPath, backupName); } catch(e){}
  try { fs.renameSync(dbPath + '-wal', backupName + '-wal'); } catch(e){}
  try { fs.renameSync(dbPath + '-shm', backupName + '-shm'); } catch(e){}
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
}

export const db = _db;

// Encryption setup for secure settings
const HAS_CUSTOM_KEY = !!process.env.ENCRYPTION_KEY;
if (!HAS_CUSTOM_KEY && process.env.NODE_ENV === 'production') {
  console.warn('CRITICAL SECURITY WARNING: No ENCRYPTION_KEY set in production. Using a default fallback.');
}

const ENCRYPTION_KEY = HAS_CUSTOM_KEY
  ? crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32) 
  : crypto.scryptSync('default_local_shamrock_key_2024', 'salt', 32);
const ALGORITHM = 'aes-256-cbc';

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
  if (!text) return text;
  try {
    const textParts = text.split(':');
    if (textParts.length !== 2) return text; // Not encrypted in expected format
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    // Sanity check: Delta Exchange keys are alphanumeric.
    // If decryption succeeds but returns junk (e.g. wrong key used), we catch common issues.
    if (decrypted.length < 10) return text;

    return decrypted;
  } catch (e) {
    console.error('CRITICAL: Decryption failed. ENCRYPTION_KEY might be incorrect.');
    return ''; // Return empty string to force failure rather than sending junk
  }
}

// Initialize tables
// WAL mode is critical for high-performance concurrent reads/writes
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id TEXT UNIQUE,
    timestamp INTEGER,
    strategy_id TEXT,
    symbol TEXT,
    action TEXT,
    order_type TEXT,
    price REAL,
    weight REAL,
    metadata TEXT,
    is_shadow INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internal_order_id TEXT,
    symbol TEXT,
    side TEXT,
    type TEXT,
    quantity REAL,
    price REAL,
    timestamp INTEGER,
    status TEXT,
    is_shadow INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    level TEXT,
    message TEXT,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS macro_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER,
    regime_state TEXT,
    killswitch_active INTEGER,
    dxy_price REAL,
    dxy_z_score REAL,
    yield_price REAL,
    yield_spread REAL,
    yield_z_score REAL,
    sentiment REAL,
    put_call_ratio REAL,
    implied_volatility REAL,
    cot_long_short_ratio REAL,
    funding_rate REAL,
    dxy_correlation REAL
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS pending_ocos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_order_id TEXT UNIQUE,
    symbol TEXT,
    side TEXT,
    quantity REAL,
    take_profit REAL,
    stop_loss REAL,
    is_shadow INTEGER DEFAULT 0,
    timestamp INTEGER
  );

  CREATE TABLE IF NOT EXISTS algo_state (
    internal_order_id TEXT PRIMARY KEY,
    algo_type TEXT,
    symbol TEXT,
    side TEXT,
    total_quantity REAL,
    remaining_quantity REAL,
    slice_count INTEGER,
    executed_slices INTEGER,
    duration_ms INTEGER,
    urgency TEXT,
    last_update INTEGER,
    state JSON
  );

  -- Optimization Indexes for faster retrieval and filtering
  CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol);
  CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
  CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level);
  CREATE INDEX IF NOT EXISTS idx_ocos_parent ON pending_ocos(parent_order_id);
`);

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN put_call_ratio REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN implied_volatility REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN cot_long_short_ratio REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN funding_rate REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN dxy_correlation REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE trades ADD COLUMN macro_regime_state TEXT');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE signals ADD COLUMN session TEXT');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE macro_snapshots ADD COLUMN yield_spread REAL');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE system_logs ADD COLUMN macro_regime_state TEXT');
} catch (e) {
  // column already exists
}

try {
  db.exec('ALTER TABLE signals ADD COLUMN is_shadow INTEGER DEFAULT 0');
} catch (e) {}

try {
  db.exec('ALTER TABLE trades ADD COLUMN is_shadow INTEGER DEFAULT 0');
} catch (e) {}

try {
  db.exec('ALTER TABLE pending_ocos ADD COLUMN is_shadow INTEGER DEFAULT 0');
} catch (e) {}

export const setSetting = (key: string, value: string, isEncrypted: boolean = false) => {
  const finalValue = isEncrypted ? encrypt(value) : value;
  db.prepare(`
    INSERT INTO user_settings (setting_key, setting_value, updated_at)
    VALUES (@key, @value, @updated_at)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = @value, updated_at = @updated_at
  `).run({ key, value: finalValue, updated_at: Date.now() });
};

export const getSetting = (key: string, isEncrypted: boolean = false): string | null => {
  const row = db.prepare('SELECT setting_value FROM user_settings WHERE setting_key = ?').get(key) as { setting_value: string } | undefined;
  if (!row) return null;
  return isEncrypted ? decrypt(row.setting_value) : row.setting_value;
};

export const insertSignal = db.prepare(`
  INSERT INTO signals (signal_id, timestamp, strategy_id, symbol, action, order_type, price, weight, metadata, session, is_shadow)
  VALUES (@signal_id, @timestamp, @strategy_id, @symbol, @action, @order_type, @price, @weight, @metadata, @session, @is_shadow)
`);

export const insertTrade = db.prepare(`
  INSERT INTO trades (internal_order_id, symbol, side, type, quantity, price, timestamp, status, macro_regime_state, is_shadow)
  VALUES (@internal_order_id, @symbol, @side, @type, @quantity, @price, @timestamp, @status, @macro_regime_state, @is_shadow)
`);

export const insertLog = db.prepare(`
  INSERT INTO system_logs (timestamp, level, message, metadata, macro_regime_state)
  VALUES (@timestamp, @level, @message, @metadata, @macro_regime_state)
`);

export const insertMacroSnapshot = db.prepare(`
  INSERT INTO macro_snapshots (
    timestamp, regime_state, killswitch_active, dxy_price, dxy_z_score, yield_price, yield_spread, yield_z_score, sentiment, put_call_ratio, implied_volatility, cot_long_short_ratio, funding_rate, dxy_correlation
  ) VALUES (
    @timestamp, @regime_state, @killswitch_active, @dxy_price, @dxy_z_score, @yield_price, @yield_spread, @yield_z_score, @sentiment, @put_call_ratio, @implied_volatility, @cot_long_short_ratio, @funding_rate, @dxy_correlation
  )
`);

export const savePendingOCO = db.prepare(`
  INSERT INTO pending_ocos (parent_order_id, symbol, side, quantity, take_profit, stop_loss, is_shadow, timestamp)
  VALUES (@parent_order_id, @symbol, @side, @quantity, @take_profit, @stop_loss, @is_shadow, @timestamp)
  ON CONFLICT(parent_order_id) DO UPDATE SET quantity = @quantity, take_profit = @take_profit, stop_loss = @stop_loss, is_shadow = @is_shadow
`);

export const deletePendingOCO = db.prepare(`
  DELETE FROM pending_ocos WHERE parent_order_id = ?
`);

export const getAllPendingOCOs = () => {
  return db.prepare('SELECT * FROM pending_ocos').all();
};

export const saveAlgoState = db.prepare(`
  INSERT INTO algo_state (internal_order_id, algo_type, symbol, side, total_quantity, remaining_quantity, slice_count, executed_slices, duration_ms, urgency, last_update, state)
  VALUES (@internal_order_id, @algo_type, @symbol, @side, @total_quantity, @remaining_quantity, @slice_count, @executed_slices, @duration_ms, @urgency, @last_update, @state)
  ON CONFLICT(internal_order_id) DO UPDATE SET 
    remaining_quantity = @remaining_quantity, 
    executed_slices = @executed_slices, 
    last_update = @last_update, 
    state = @state
`);

export const deleteAlgoState = db.prepare(`
  DELETE FROM algo_state WHERE internal_order_id = ?
`);

export const getAllAlgoStates = () => {
  return db.prepare('SELECT * FROM algo_state').all();
};

const handleExit = () => {
  try {
    db.close();
  } catch (err) {
    console.error('Error closing database:', err);
  }
};

process.on('exit', handleExit);
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));
