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
  `);

  const columns = database
    .prepare('PRAGMA table_info(farm_profiles)')
    .all()
    .map((column) => column.name);

  const addColumn = (name, sql) => {
    if (!columns.includes(name)) {
      database.exec(`ALTER TABLE farm_profiles ADD COLUMN ${sql}`);
    }
  };

  addColumn('farm_balance', 'farm_balance INTEGER NOT NULL DEFAULT 0');
  addColumn('upgrade_balance', 'upgrade_balance INTEGER NOT NULL DEFAULT 0');
  addColumn('total_income', 'total_income INTEGER NOT NULL DEFAULT 0');
  addColumn('parts', 'parts INTEGER NOT NULL DEFAULT 0');
  addColumn('last_collect_at', 'last_collect_at INTEGER');
  addColumn('farm_json', 'farm_json TEXT');
  addColumn('resources_json', 'resources_json TEXT');
  addColumn('buildings_json', 'buildings_json TEXT');
  addColumn('license_level', 'license_level INTEGER NOT NULL DEFAULT 0');
  addColumn('protection_level', 'protection_level INTEGER NOT NULL DEFAULT 0');
  addColumn('raid_power', 'raid_power INTEGER NOT NULL DEFAULT 0');
  addColumn('turret_json', 'turret_json TEXT');
  addColumn('synced_from_wizebot_at', 'synced_from_wizebot_at INTEGER');

  database.exec(`
    UPDATE farm_profiles SET
      farm_balance = COALESCE(farm_balance, 0),
      upgrade_balance = COALESCE(upgrade_balance, 0),
      total_income = COALESCE(total_income, 0),
      parts = COALESCE(parts, 0),
      license_level = COALESCE(license_level, 0),
      protection_level = COALESCE(protection_level, 0),
      raid_power = COALESCE(raid_power, 0)
  `);
}

function closeDb() {
  if (db) db.close();
  db = null;
}

module.exports = { getDb, closeDb };
