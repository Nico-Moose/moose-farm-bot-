const { getDb } = require('./dbService');

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_) {
    return fallback;
  }
}

function normalizeProfile(row) {
  if (!row) return null;

  const farm = parseJsonSafe(row.farm_json, {});
  const configs = parseJsonSafe(row.configs_json, {});
  const turret = parseJsonSafe(row.turret_json, {});

  return {
    ...row,

    level: Number(row.level ?? 0),
    farm_balance: Number(row.farm_balance ?? 0),
    upgrade_balance: Number(row.upgrade_balance ?? 0),
    total_income: Number(row.total_income ?? 0),
    parts: Number(row.parts ?? 0),
    last_collect_at: row.last_collect_at ? Number(row.last_collect_at) : null,

    license_level: Number(row.license_level ?? 0),
    protection_level: Number(row.protection_level ?? 0),
    raid_power: Number(row.raid_power ?? 0),
    last_wizebot_sync_at: row.last_wizebot_sync_at ? Number(row.last_wizebot_sync_at) : null,

    farm,
    configs,
    turret,

    created_at: Number(row.created_at) || Date.now(),
    updated_at: Number(row.updated_at) || Date.now(),
  };
}

function upsertTwitchUser(user) {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    INSERT INTO twitch_users (twitch_id, login, display_name, avatar_url)
    VALUES (@id, @login, @display_name, @profile_image_url)
    ON CONFLICT(twitch_id) DO UPDATE SET
      login = excluded.login,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = CURRENT_TIMESTAMP
  `).run(user);

  db.prepare(`
    INSERT OR IGNORE INTO farm_profiles (
      twitch_id,
      level,
      farm_balance,
      upgrade_balance,
      total_income,
      parts,
      last_collect_at,
      created_at,
      updated_at
    )
    VALUES (?, 0, 0, 0, 0, 0, ?, ?, ?)
  `).run(user.id, now, now, now);
}

function getProfile(twitchId) {
  const row = getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,

      f.level,
      f.farm_balance,
      f.upgrade_balance,
      f.total_income,
      f.parts,
      f.last_collect_at,
      f.created_at,
      f.updated_at,

      f.farm_json,
      f.configs_json,
      f.license_level,
      f.protection_level,
      f.raid_power,
      f.turret_json,
      f.last_wizebot_sync_at
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE u.twitch_id = ?
  `).get(twitchId);

  return normalizeProfile(row);
}

function updateProfile(profile) {
  const safe = normalizeProfile(profile);
  const now = Date.now();

  getDb().prepare(`
    UPDATE farm_profiles SET
      level = @level,
      farm_balance = @farm_balance,
      upgrade_balance = @upgrade_balance,
      total_income = @total_income,
      parts = @parts,
      last_collect_at = @last_collect_at,

      farm_json = @farm_json,
      configs_json = @configs_json,
      license_level = @license_level,
      protection_level = @protection_level,
      raid_power = @raid_power,
      turret_json = @turret_json,

      updated_at = @updated_at
    WHERE twitch_id = @twitch_id
  `).run({
    ...safe,
    farm_json: JSON.stringify(safe.farm || {}),
    configs_json: JSON.stringify(safe.configs || {}),
    turret_json: JSON.stringify(safe.turret || {}),
    updated_at: now
  });

  return getProfile(safe.twitch_id);
}

function logFarmEvent(twitchId, type, payload = {}) {
  getDb().prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(twitchId, type, JSON.stringify(payload), Date.now());
}

module.exports = {
  upsertTwitchUser,
  getProfile,
  updateProfile,
  logFarmEvent
};
