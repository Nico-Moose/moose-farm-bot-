const { getDb } = require('./dbService');
const { parseJsonSafe } = require('./farm/numberUtils');

function normalizeProfile(row) {
  if (!row) return null;

  return {
    ...row,
    level: Number(row.level ?? 0),
    farm_balance: Number(row.farm_balance ?? 0),
    twitch_balance: Number(row.twitch_balance ?? 0),
    upgrade_balance: Number(row.upgrade_balance ?? 0),
    total_income: Number(row.total_income ?? 0),
    parts: Number(row.parts ?? 0),
    last_collect_at: row.last_collect_at ? Number(row.last_collect_at) : null,
    license_level: Number(row.license_level ?? 0),
    protection_level: Number(row.protection_level ?? 0),
    raid_power: Number(row.raid_power ?? 0),
    last_wizebot_sync_at: row.last_wizebot_sync_at ? Number(row.last_wizebot_sync_at) : null,
    farm: parseJsonSafe(row.farm_json, {}),
    configs: parseJsonSafe(row.configs_json, {}),
    turret: parseJsonSafe(row.turret_json, {}),
    created_at: Number(row.created_at) || Date.now(),
    updated_at: Number(row.updated_at) || Date.now()
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
      twitch_balance,
      upgrade_balance,
      total_income,
      parts,
      last_collect_at,
      created_at,
      updated_at
    )
    VALUES (?, 0, 0, 0, 0, 0, 0, ?, ?, ?)
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
      f.twitch_balance,
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

function getProfileByLogin(login) {
  const normalizedLogin = String(login || '').trim().toLowerCase().replace(/^@/, '');
  if (!normalizedLogin) return null;

  const row = getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,
      f.level,
      f.farm_balance,
      f.twitch_balance,
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
    WHERE LOWER(u.login) = ?
  `).get(normalizedLogin);

  return normalizeProfile(row);
}

function updateProfile(profile) {
  const safe = normalizeProfile({
    ...profile,
    farm_json: JSON.stringify(profile.farm || {}),
    configs_json: JSON.stringify(profile.configs || {}),
    turret_json: JSON.stringify(profile.turret || {})
  });

  const now = Date.now();

  getDb().prepare(`
    UPDATE farm_profiles SET
      level = @level,
      farm_balance = @farm_balance,
      twitch_balance = @twitch_balance,
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
      last_wizebot_sync_at = @last_wizebot_sync_at,
      updated_at = @updated_at
    WHERE twitch_id = @twitch_id
  `).run({
    ...safe,
    farm_json: JSON.stringify(safe.farm || {}),
    configs_json: JSON.stringify(safe.configs || {}),
    turret_json: JSON.stringify(safe.turret || {}),
    last_wizebot_sync_at: safe.last_wizebot_sync_at || null,
    updated_at: now
  });

  return getProfile(safe.twitch_id);
}


function markWizebotSyncAt(twitchId, timestamp = Date.now()) {
  // Важный момент: фоновый sync в WizeBot не должен менять updated_at профиля.
  // Иначе следующий клик на сайте ловит ложный stale_profile, хотя игровое состояние не менялось.
  getDb().prepare(`
    UPDATE farm_profiles
    SET last_wizebot_sync_at = ?
    WHERE twitch_id = ?
  `).run(timestamp, twitchId);

  return getProfile(twitchId);
}

function listProfiles() {
  const rows = getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,
      f.level,
      f.farm_balance,
      f.twitch_balance,
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
  `).all();

  return rows.map(normalizeProfile).filter(Boolean);
}

function logFarmEvent(twitchId, type, payload = {}) {
  const db = getDb();
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(twitchId, type, JSON.stringify(payload), createdAt);

  // Храним только последние 10 записей каждого типа для игрока.
  // Это экономит место и не даёт журналу разрастаться бесконечно.
  db.prepare(`
    DELETE FROM farm_events
    WHERE twitch_id = ?
      AND type = ?
      AND id NOT IN (
        SELECT id FROM farm_events
        WHERE twitch_id = ? AND type = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 10
      )
  `).run(twitchId, type, twitchId, type);
}

function listFarmEvents({ twitchId = null, login = '', type = '', limit = 100 } = {}) {
  limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));

  let sql = `
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
  `;
  const where = [];
  const params = [];

  if (twitchId) {
    where.push(`e.twitch_id = ?`);
    params.push(twitchId);
  }

  if (login) {
    where.push(`LOWER(u.login) = ?`);
    params.push(String(login).toLowerCase().replace(/^@/, ''));
  }

  if (type) {
    where.push(`e.type = ?`);
    params.push(type);
  }

  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY e.created_at DESC LIMIT ?`;
  params.push(limit);

  return getDb().prepare(sql).all(...params).map((event) => {
    let payload = {};
    try { payload = JSON.parse(event.payload || '{}'); } catch (_) {}
    return { ...event, payload };
  });
}

module.exports = {
  upsertTwitchUser,
  getProfile,
  getProfileByLogin,
  updateProfile,
  markWizebotSyncAt,
  listProfiles,
  logFarmEvent,
  listFarmEvents
};
