const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../config');

let db;

function getDb() {
  if (db) return db;

  const file = path.resolve(config.databasePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  db = new Database(file);
  db.pragma('journal_mode = WAL');

  migrate(db);

  console.log(`[DB] SQLite connected: ${file}`);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS twitch_users (
      twitch_id TEXT PRIMARY KEY,
      login TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS farm_profiles (
      twitch_id TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 0,
      farm_balance INTEGER NOT NULL DEFAULT 0,
      twitch_balance INTEGER NOT NULL DEFAULT 0,
      upgrade_balance INTEGER NOT NULL DEFAULT 0,
      total_income INTEGER NOT NULL DEFAULT 0,
      parts INTEGER NOT NULL DEFAULT 0,
      last_collect_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );

    CREATE TABLE IF NOT EXISTS farm_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      twitch_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farm_presence (
      twitch_id TEXT PRIMARY KEY,
      last_seen_at INTEGER NOT NULL,
      page TEXT,
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );
  `);

  const columns = database
    .prepare(`PRAGMA table_info(farm_profiles)`)
    .all()
    .map((c) => c.name);

  function addColumn(name, sql) {
    if (!columns.includes(name)) {
      database.exec(`ALTER TABLE farm_profiles ADD COLUMN ${sql}`);
    }
  }

  addColumn('farm_balance', 'farm_balance INTEGER NOT NULL DEFAULT 0');
  addColumn('twitch_balance', 'twitch_balance INTEGER NOT NULL DEFAULT 0');
  addColumn('upgrade_balance', 'upgrade_balance INTEGER NOT NULL DEFAULT 0');
  addColumn('total_income', 'total_income INTEGER NOT NULL DEFAULT 0');
  addColumn('parts', 'parts INTEGER NOT NULL DEFAULT 0');
  addColumn('last_collect_at', 'last_collect_at INTEGER');
  addColumn('farm_json', `farm_json TEXT NOT NULL DEFAULT '{}'`);
  addColumn('configs_json', `configs_json TEXT NOT NULL DEFAULT '{}'`);
  addColumn('license_level', 'license_level INTEGER NOT NULL DEFAULT 0');
  addColumn('protection_level', 'protection_level INTEGER NOT NULL DEFAULT 0');
  addColumn('raid_power', 'raid_power INTEGER NOT NULL DEFAULT 0');
  addColumn('turret_json', `turret_json TEXT NOT NULL DEFAULT '{}'`);
  addColumn('last_wizebot_sync_at', 'last_wizebot_sync_at INTEGER');

  database.exec(`
    CREATE TABLE IF NOT EXISTS loot_balances (
      twitch_id TEXT PRIMARY KEY,
      donate_balance INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );

    CREATE TABLE IF NOT EXISTS loot_inventory (
      twitch_id TEXT NOT NULL,
      entry_id INTEGER NOT NULL,
      prize_id TEXT,
      prize_label TEXT NOT NULL,
      rarity TEXT NOT NULL DEFAULT 'common',
      visual_level INTEGER NOT NULL DEFAULT 1,
      donate_sum INTEGER NOT NULL DEFAULT 0,
      case_name TEXT,
      won_date TEXT,
      status TEXT NOT NULL DEFAULT 'stored',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_merged_at TEXT,
      PRIMARY KEY (twitch_id, entry_id),
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );

    CREATE TABLE IF NOT EXISTS loot_taken_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      twitch_id TEXT NOT NULL,
      login TEXT,
      display_name TEXT,
      entry_id INTEGER NOT NULL,
      prize_id TEXT,
      prize_label TEXT NOT NULL,
      donate_sum INTEGER NOT NULL DEFAULT 0,
      case_name TEXT,
      won_date TEXT,
      taken_date TEXT,
      rarity TEXT NOT NULL DEFAULT 'common',
      visual_level INTEGER NOT NULL DEFAULT 1,
      restored INTEGER NOT NULL DEFAULT 0,
      restored_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );

    CREATE TABLE IF NOT EXISTS loot_promo_redeemed (
      twitch_id TEXT NOT NULL,
      code TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      redeemed_at INTEGER NOT NULL,
      PRIMARY KEY (twitch_id, code),
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );
  `);

  const presenceColumns = database
    .prepare(`PRAGMA table_info(farm_presence)`)
    .all()
    .map((c) => c.name);

  if (!presenceColumns.includes('hidden_from_online')) {
    database.exec(`ALTER TABLE farm_presence ADD COLUMN hidden_from_online INTEGER NOT NULL DEFAULT 0`);
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_twitch_users_login_lower ON twitch_users(LOWER(login));
    CREATE INDEX IF NOT EXISTS idx_farm_events_twitch_type_created ON farm_events(twitch_id, type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_farm_events_created ON farm_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_farm_events_type_created ON farm_events(type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_farm_presence_seen ON farm_presence(last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_loot_inventory_twitch_entry ON loot_inventory(twitch_id, entry_id);
    CREATE INDEX IF NOT EXISTS idx_loot_taken_history_twitch_created ON loot_taken_history(twitch_id, created_at DESC);
  `);
}

function closeDb() {
  if (db) db.close();
  db = null;
}

module.exports = { getDb, closeDb };
