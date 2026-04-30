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
      level INTEGER NOT NULL DEFAULT 1,
      coins INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (twitch_id) REFERENCES twitch_users(twitch_id)
    );
  `);
}

function closeDb() {
  if (db) db.close();
  db = null;
}

module.exports = { getDb, closeDb };
