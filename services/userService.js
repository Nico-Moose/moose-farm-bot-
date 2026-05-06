const { getDb } = require('./dbService');
const { getCache, setCache } = require('./apiCacheService');
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


let listTopProfilesLiteStmt = null;

function getListTopProfilesLiteStmt() {
  if (!listTopProfilesLiteStmt) {
    listTopProfilesLiteStmt = getDb().prepare(`
      SELECT
        u.twitch_id,
        u.login,
        u.display_name,
        f.level,
        f.farm_balance,
        f.twitch_balance,
        f.upgrade_balance,
        f.parts,
        f.farm_json,
        f.configs_json
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    `);
  }
  return listTopProfilesLiteStmt;
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

function hasMeaningfulFarm(profile) {
  return !!(
    profile &&
    profile.farm &&
    typeof profile.farm === 'object' &&
    Object.keys(profile.farm).length > 0
  );
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

  const directProfile = normalizeProfile(row);
  if (!directProfile) return null;

  if (hasMeaningfulFarm(directProfile)) {
    return directProfile;
  }

  const login = String(directProfile.login || '').trim().toLowerCase();
  if (!login) {
    return directProfile;
  }

  const loginProfile = getProfileByLogin(login);
  if (!loginProfile) {
    return directProfile;
  }

  const directSyncAt = Number(directProfile.last_wizebot_sync_at || 0);
  const loginSyncAt = Number(loginProfile.last_wizebot_sync_at || 0);

  if (
    loginProfile.twitch_id !== directProfile.twitch_id &&
    hasMeaningfulFarm(loginProfile) &&
    loginSyncAt >= directSyncAt
  ) {
    return {
      ...loginProfile,
      twitch_id: directProfile.twitch_id,
      login: directProfile.login || loginProfile.login,
      display_name: directProfile.display_name || loginProfile.display_name,
      avatar_url: directProfile.avatar_url || loginProfile.avatar_url
    };
  }

  return directProfile;
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
    ORDER BY
      CASE WHEN u.twitch_id LIKE 'legacy:%' THEN 1 ELSE 0 END ASC,
      COALESCE(f.last_wizebot_sync_at, 0) DESC,
      COALESCE(f.updated_at, 0) DESC,
      COALESCE(f.created_at, 0) DESC
    LIMIT 1
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

function listRaidCandidateProfiles() {
  const rows = getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      f.level,
      f.farm_balance,
      f.twitch_balance,
      f.upgrade_balance,
      f.parts,
      f.last_collect_at,
      f.created_at,
      f.farm_json,
      f.configs_json,
      f.protection_level,
      f.raid_power
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
  `).all();

  return rows.map(normalizeProfile).filter(Boolean);
}

function listTopProfilesLite() {
  const cacheKey = 'farm:top:profiles';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const rows = getListTopProfilesLiteStmt().all();
  const result = rows.map(normalizeProfile).filter(Boolean);
  return setCache(cacheKey, result, 5000);
}


function touchPresence(twitchId, page = 'farm') {
  if (!twitchId) return;
  const now = Date.now();
  getDb().prepare(`
    INSERT INTO farm_presence (twitch_id, last_seen_at, page)
    VALUES (?, ?, ?)
    ON CONFLICT(twitch_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      page = excluded.page
  `).run(twitchId, now, String(page || 'farm'));
}

function getPresenceVisibility(twitchId) {
  if (!twitchId) return { hidden_from_online: false };
  const row = getDb().prepare(`
    SELECT hidden_from_online
    FROM farm_presence
    WHERE twitch_id = ?
  `).get(twitchId);
  return { hidden_from_online: !!Number(row?.hidden_from_online || 0) };
}

function setPresenceVisibility(twitchId, hiddenFromOnline = false) {
  if (!twitchId) return { hidden_from_online: false };
  const now = Date.now();
  const hidden = hiddenFromOnline ? 1 : 0;
  getDb().prepare(`
    INSERT INTO farm_presence (twitch_id, last_seen_at, page, hidden_from_online)
    VALUES (?, ?, 'farm', ?)
    ON CONFLICT(twitch_id) DO UPDATE SET
      hidden_from_online = excluded.hidden_from_online
  `).run(twitchId, now, hidden);
  return { hidden_from_online: !!hidden };
}

function listOnlineFarmers({ withinMs = 3 * 60 * 1000, limit = 30 } = {}) {
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
  const cutoff = Date.now() - Math.max(30 * 1000, Number(withinMs || 0));
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
      f.last_wizebot_sync_at,
      p.last_seen_at,
      p.page
    FROM farm_presence p
    JOIN twitch_users u ON u.twitch_id = p.twitch_id
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE p.last_seen_at >= ?
      AND COALESCE(p.hidden_from_online, 0) = 0
    ORDER BY COALESCE(f.level, 0) DESC, LOWER(COALESCE(u.display_name, u.login)) ASC, p.last_seen_at DESC
    LIMIT ?
  `).all(cutoff, limit);

  return rows.map(normalizeProfile).filter((profile) => !!(profile && hasMeaningfulFarm(profile))).map((profile, idx) => ({
    ...profile,
    last_seen_at: Number(rows[idx].last_seen_at || 0),
    page: rows[idx].page || 'farm'
  }));
}

function listFarmerDirectory({ search = '', limit = 500 } = {}) {
  limit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 500));
  const q = String(search || '').trim().toLowerCase().replace(/^@/, '');
  let sql = `
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
      f.last_wizebot_sync_at,
      p.last_seen_at,
      p.hidden_from_online
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    LEFT JOIN farm_presence p ON p.twitch_id = u.twitch_id
  `;
  const params = []
  if (q) {
    sql += ` WHERE LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?`;
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ` ORDER BY LOWER(COALESCE(u.display_name, u.login)) ASC LIMIT ?`;
  params.push(limit);
  const rows = getDb().prepare(sql).all(...params);
  return rows.map((row) => ({
    ...normalizeProfile(row),
    is_online: Number(row.last_seen_at || 0) >= Date.now() - 3 * 60 * 1000 && !Number(row.hidden_from_online || 0),
    last_seen_at: Number(row.last_seen_at || 0)
  })).filter((profile) => !!(profile && hasMeaningfulFarm(profile)));
}

function logFarmEvent(twitchId, type, payload = {}) {
  const db = getDb();
  const createdAt = Date.now();
  db.prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(twitchId, type, JSON.stringify(payload), createdAt);

  // Журнал храним 7 дней. Это сохраняет историю по дням и не режет полезные события по типам.
  db.prepare(`
    DELETE FROM farm_events
    WHERE created_at < ?
  `).run(createdAt - 7 * 24 * 60 * 60 * 1000);
}

function listFarmEvents({ twitchId = null, login = '', type = '', limit = 100, days = 0 } = {}) {
  limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 100));
  days = Math.min(30, Math.max(0, parseInt(days, 10) || 0));

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

  if (days > 0) {
    where.push('e.created_at >= ?');
    params.push(Date.now() - days * 24 * 60 * 60 * 1000);
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
  listRaidCandidateProfiles,
  listTopProfilesLite,
  touchPresence,
  getPresenceVisibility,
  setPresenceVisibility,
  listOnlineFarmers,
  listFarmerDirectory,
  logFarmEvent,
  listFarmEvents
};
