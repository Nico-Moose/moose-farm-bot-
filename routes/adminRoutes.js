const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { syncWizebotFarmToProfile } = require('../services/wizebotSyncService');
const { syncProfileToWizebot } = require('../services/wizebotApiService');
const { upsertTwitchUser, getProfile: getProfileById, updateProfile } = require('../services/userService');
const { getStreamStatus, setSetting } = require('../services/streamStatusService');
const { setMarketStock } = require('../services/farm/marketService');
const { triggerWizebotLegacyFarmMigration, sayToChannel } = require('../services/twitchChatService');
const registerAdminFieldAndLookupRoutes = require('./admin/registerAdminFieldAndLookupRoutes');
const registerAdminSyncRoutes = require('./admin/registerAdminSyncRoutes');
const registerAdminMutationRoutes = require('./admin/registerAdminMutationRoutes');
const registerAdminToolsRoutes = require('./admin/registerAdminToolsRoutes');

function parseAmount(value) {
  if (typeof value === 'number') return Math.trunc(value);

  let raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return NaN;

  let sign = 1;
  if (raw.startsWith('+')) raw = raw.slice(1);
  if (raw.startsWith('-')) {
    sign = -1;
    raw = raw.slice(1);
  }

  const multipliers = [
    ['трлн', 1_000_000_000_000],
    ['млрд', 1_000_000_000],
    ['кк', 1_000_000],
    ['kk', 1_000_000],
    ['к', 1_000],
    ['k', 1_000]
  ];

  let multiplier = 1;
  for (const [suffix, mult] of multipliers) {
    if (raw.endsWith(suffix)) {
      multiplier = mult;
      raw = raw.slice(0, -suffix.length);
      break;
    }
  }

  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  return Math.trunc(sign * n * multiplier);
}

function clampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return NaN;
  return Math.min(max, Math.max(min, n));
}

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_) {
    return fallback;
  }
}

function normalizeProfile(row) {
  if (!row) return null;
  return {
    twitch_id: row.twitch_id,
    login: row.login,
    twitch_login: row.login,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    level: Number(row.level || 0),
    farm_balance: Number(row.farm_balance || 0),
    upgrade_balance: Number(row.upgrade_balance || 0),
    total_income: Number(row.total_income || 0),
    parts: Number(row.parts || 0),
    last_collect_at: row.last_collect_at ? Number(row.last_collect_at) : null,
    license_level: Number(row.license_level || 0),
    protection_level: Number(row.protection_level || 0),
    raid_power: Number(row.raid_power || 0),
    last_wizebot_sync_at: row.last_wizebot_sync_at ? Number(row.last_wizebot_sync_at) : null,
    farm: parseJsonSafe(row.farm_json, {}),
    configs: parseJsonSafe(row.configs_json, {}),
    turret: parseJsonSafe(row.turret_json, {})
  };
}

function getProfileByLogin(db, login) {
  login = String(login || '').toLowerCase().replace(/^@/, '');
  const row = db.prepare(`
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
    LIMIT 1
  `).get(login);
  return normalizeProfile(row);
}

function updateFarmJsonLevel(db, twitchId, level) {
  const row = db.prepare(`SELECT farm_json FROM farm_profiles WHERE twitch_id = ?`).get(twitchId);
  const farm = parseJsonSafe(row?.farm_json, {});
  farm.level = level;
  db.prepare(`UPDATE farm_profiles SET farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(JSON.stringify(farm), Date.now(), twitchId);
}

function updateFarmJsonParts(db, twitchId, parts) {
  const row = db.prepare(`SELECT farm_json FROM farm_profiles WHERE twitch_id = ?`).get(twitchId);
  const farm = parseJsonSafe(row?.farm_json, {});
  farm.resources = farm.resources || {};
  farm.resources.parts = parts;
  db.prepare(`UPDATE farm_profiles SET farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(JSON.stringify(farm), Date.now(), twitchId);
}

function logAdminEvent(db, twitchId, type, payload) {
  try {
    db.prepare(`INSERT INTO farm_events (twitch_id, type, payload, created_at) VALUES (?, ?, ?, ?)`)
      .run(twitchId, type, JSON.stringify(payload || {}), Date.now());
  } catch (_) {}
}

module.exports = function (db) {
  const router = express.Router();
  const pendingAdminActions = new Set();

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForLegacyMigrationPush(login, beforeSyncAt, timeoutMs = 20000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const profile = getProfileByLogin(db, login);
      const syncAt = Number(profile?.last_wizebot_sync_at || 0);
      const level = Number(profile?.level || profile?.farm?.level || 0);
      const hasFarmPayload = !!profile && (syncAt > beforeSyncAt || level > 0);
      if (hasFarmPayload) return profile;
      await sleep(700);
    }
    return null;
  }

  function adminActionGuard(req, res, next) {
    if (req.method !== 'POST') return next();
    const adminLogin = (
      req.session?.twitchUser?.login ||
      req.session?.user?.login ||
      req.session?.user?.username ||
      'admin'
    ).toLowerCase();
    const target = String(req.body?.login || req.body?.oldLogin || req.body?.newLogin || 'global').toLowerCase();
    const key = `${adminLogin}:${req.path}:${target}`;
    if (pendingAdminActions.has(key)) {
      return res.status(409).json({ ok: false, error: 'Действие уже выполняется. Подожди завершения предыдущего клика.' });
    }
    pendingAdminActions.add(key);
    res.on('finish', () => pendingAdminActions.delete(key));
    res.on('close', () => pendingAdminActions.delete(key));
    next();
  }

  function listPlayerLogins(prefix = '') {
    const q = String(prefix || '').toLowerCase().replace(/^@/, '').trim();
    const like = `${q}%`;
    return db.prepare(`
      SELECT u.login, u.display_name, f.level
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
      ORDER BY LOWER(u.login) ASC
      LIMIT 50
    `).all(q, like, like);
  }

  function sanitizeAdminLogin(value) {
    return String(value || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  }

  function getAllProfiles() {
    return db.prepare(`
      SELECT u.login, f.twitch_id, f.farm_balance
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      ORDER BY LOWER(u.login) ASC
    `).all();
  }

  function deepCloneSafe(value, fallback = {}) {
    try {
      return JSON.parse(JSON.stringify(value ?? fallback));
    } catch (_) {
      return fallback;
    }
  }

  function stripAdminBackups(farm) {
    const cleanFarm = deepCloneSafe(farm, {});
    if (cleanFarm && typeof cleanFarm === 'object' && cleanFarm.adminBackups) delete cleanFarm.adminBackups;
    return cleanFarm;
  }

  function saveFarmObject(twitchId, farm) {
    const cleanFarm = deepCloneSafe(farm || {}, {});
    db.prepare(`UPDATE farm_profiles SET farm_json = ?, updated_at = ? WHERE twitch_id = ?`)
      .run(JSON.stringify(cleanFarm), Date.now(), twitchId);
  }

  function saveFarmBackup(profile, reason) {
    if (!profile) return null;
    const sourceFarm = profile.farm || {};
    const farmSnapshot = stripAdminBackups(sourceFarm);
    const backup = {
      createdAt: Date.now(),
      reason: reason || 'admin_backup',
      twitch_id: profile.twitch_id,
      login: profile.login,
      display_name: profile.display_name,
      level: profile.level,
      farm_balance: profile.farm_balance,
      upgrade_balance: profile.upgrade_balance,
      total_income: profile.total_income,
      parts: profile.parts,
      last_collect_at: profile.last_collect_at,
      farm: farmSnapshot,
      configs: deepCloneSafe(profile.configs || {}, {}),
      license_level: profile.license_level,
      protection_level: profile.protection_level,
      raid_power: profile.raid_power,
      turret: deepCloneSafe(profile.turret || {}, {})
    };
    const farmToSave = deepCloneSafe(sourceFarm, {});
    const existingBackups = Array.isArray(farmToSave.adminBackups) ? farmToSave.adminBackups : [];
    farmToSave.adminBackups = [backup, ...existingBackups].slice(0, 10);
    saveFarmObject(profile.twitch_id, farmToSave);
    return backup;
  }

  function restoreFarmBackup(profile) {
    const farm = profile?.farm || {};
    const backups = Array.isArray(farm.adminBackups) ? farm.adminBackups : [];
    const backup = backups[0];
    if (!backup) return null;
    const restoredFarm = backup.farm || {};
    restoredFarm.adminBackups = backups;
    db.prepare(`UPDATE farm_profiles SET level=?, farm_balance=?, upgrade_balance=?, total_income=?, parts=?, last_collect_at=?, farm_json=?, configs_json=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=? WHERE twitch_id=?`).run(
      Number(backup.level || 0),
      Number(backup.farm_balance || 0),
      Number(backup.upgrade_balance || 0),
      Number(backup.total_income || 0),
      Number(backup.parts || 0),
      backup.last_collect_at || null,
      JSON.stringify(restoredFarm),
      JSON.stringify(backup.configs || {}),
      Number(backup.license_level || 0),
      Number(backup.protection_level || 0),
      Number(backup.raid_power || 0),
      JSON.stringify(backup.turret || {}),
      Date.now(),
      profile.twitch_id
    );
    return backup;
  }

  function resetCaseCooldownOnly(profile) {
    const farm = deepCloneSafe(profile.farm || {}, {});
    farm.lastCaseAt = 0;
    farm.caseCooldownUntil = 0;
    if (farm.cases && typeof farm.cases === 'object') {
      farm.cases.lastOpenedAt = 0;
      farm.cases.cooldownUntil = 0;
    }
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_case_cooldown', { login: profile.login });
  }

  function resetRaidCooldownOnly(profile) {
    const farm = deepCloneSafe(profile.farm || {}, {});
    farm.raidCooldownUntil = 0;
    farm.lastRaidAt = 0;
    farm.shieldUntil = 0;
    farm.shield_until = 0;
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_raid_cooldown', { login: profile.login });
  }

  function resetOffcollectCooldownOnly(profile) {
    const farm = deepCloneSafe(profile.farm || {}, {});
    const readyAt = Date.now() - 24 * 60 * 60 * 1000;
    farm.lastWithdrawAt = readyAt;
    db.prepare(`UPDATE farm_profiles SET last_collect_at=?, farm_json=?, updated_at=? WHERE twitch_id=?`)
      .run(readyAt, JSON.stringify(farm), Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_offcollect_cooldown', { login: profile.login });
  }

  function resetGamusOnly(profile) {
    const farm = deepCloneSafe(profile.farm || {}, {});
    farm.lastGamusAt = 0;
    delete farm.gamusLastClaimAt;
    delete farm.gamus_bonus_ts;
    if (farm.gamus && typeof farm.gamus === 'object') farm.gamus.lastClaimAt = 0;
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_gamus', { login: profile.login });
  }

  async function importLegacyFarmToSite(login, source = 'admin_import_legacy_farm') {
    login = sanitizeAdminLogin(login);
    if (!login) return { ok: false, error: 'Укажи ник игрока' };

    let profile = getProfileByLogin(db, login);
    if (!profile) {
      upsertTwitchUser({ id: `legacy:${login}`, login, display_name: login, profile_image_url: '' });
      profile = getProfileByLogin(db, login);
    }
    if (!profile) return { ok: false, error: 'Не удалось создать профиль игрока на сайте' };

    saveFarmBackup(profile, 'before_import_legacy_farm');

    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (result.ok) {
      const updatedProfile = updateProfile({ ...profile, ...result.profile, twitch_id: profile.twitch_id });
      let pushBack = null;
      try { pushBack = await syncProfileToWizebot(updatedProfile); } catch (error) { pushBack = { ok: false, error: error.message || String(error) }; }
      const freshProfile = getProfileById(profile.twitch_id);
      logAdminEvent(db, profile.twitch_id, source, { login, mode: 'wizebot_api_custom_data', imported: result.imported || null, pushBack });
      return { ok: true, profile: freshProfile, imported: result.imported || null, pushBack, mode: 'wizebot_api_custom_data' };
    }

    const beforeSyncAt = Number(profile.last_wizebot_sync_at || 0);
    let trigger = null;
    try { trigger = await triggerWizebotLegacyFarmMigration(login); } catch (error) { trigger = { ok: false, error: error.message || String(error) }; }
    if (!trigger || !trigger.ok) {
      return {
        ok: false,
        error: 'Старая ферма не прочиталась через WizeBot API, и сайт не смог запустить WizeBot-команду миграции. Проверь, что Twitch chat bot подключён и в WizeBot создана команда !сайтмигрферма.',
        apiError: result.error || null,
        trigger
      };
    }
    const migratedProfile = await waitForLegacyMigrationPush(login, beforeSyncAt);
    if (!migratedProfile) {
      return {
        ok: false,
        error: 'Команда миграции отправлена в Twitch chat, но сайт не получил /bridge/farm-v2-push от WizeBot. Проверь команду !сайтмигрферма в WizeBot и ALLOWED_CALLERS внутри неё.',
        apiError: result.error || null,
        trigger
      };
    }
    logAdminEvent(db, migratedProfile.twitch_id || profile.twitch_id, source, { login, mode: 'wizebot_chat_legacy_migrator', trigger, apiError: result.error || null });
    return { ok: true, profile: migratedProfile, imported: { login, mode: 'wizebot_chat_legacy_migrator' }, pushBack: trigger, mode: 'wizebot_chat_legacy_migrator' };
  }

  async function syncPlayerFromWizebot(login, source = 'admin_sync_from_wizebot') {
    login = sanitizeAdminLogin(login);
    if (!login) return { ok: false, error: 'Укажи ник игрока' };
    let profile = getProfileByLogin(db, login);
    if (!profile) {
      upsertTwitchUser({ id: `wizebot:${login}`, login, display_name: login, profile_image_url: '' });
      profile = getProfileByLogin(db, login);
    }
    if (!profile) return { ok: false, error: 'Не удалось создать профиль игрока на сайте' };
    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (!result.ok) return result;
    const updatedProfile = updateProfile({ ...profile, ...result.profile, twitch_id: profile.twitch_id });
    let pushBack = null;
    try { pushBack = await syncProfileToWizebot(updatedProfile); } catch (error) { pushBack = { ok: false, error: error.message || String(error) }; }
    logAdminEvent(db, profile.twitch_id, source, { login, imported: result.imported || null, pushBack });
    return { ok: true, profile: getProfileById(profile.twitch_id), imported: result.imported || null, pushBack };
  }

  async function pushPlayerToWizebot(login, source = 'admin_push_to_wizebot') {
    const profile = getProfileByLogin(db, login);
    if (!profile) return { ok: false, error: 'Игрок не найден' };
    const result = await syncProfileToWizebot(profile);
    logAdminEvent(db, profile.twitch_id, source, { login, result });
    return { ok: true, profile: getProfileById(profile.twitch_id), result };
  }

  function loadFarmers(query = {}) {
    const prefix = String(query.prefix || '').trim().toLowerCase().replace(/^@/, '');
    const sort = String(query.sort || 'level').toLowerCase();
    const requestedLimit = parseInt(query.limit || '200', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 200;
    const like = `%${prefix}%`;
    const rows = db.prepare(`
      SELECT u.login, u.display_name, f.twitch_id, f.level, f.farm_balance, f.parts
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      WHERE json_valid(COALESCE(f.farm_json, '{}'))
        AND json_extract(COALESCE(f.farm_json, '{}'), '$.level') IS NOT NULL
        AND (? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?)
      ORDER BY
        CASE WHEN ? = 'alphabet' THEN LOWER(u.login) END ASC,
        CASE WHEN ? != 'alphabet' THEN f.level END DESC,
        LOWER(u.login) ASC
    `).all(prefix, like, like, sort, sort);
    const total = rows.length;
    const farmers = rows.slice(0, limit).map((row, index) => ({
      login: row.login,
      display_name: row.display_name || row.login,
      level: Number(row.level || 0),
      farm_balance: Number(row.farm_balance || 0),
      parts: Number(row.parts || 0),
      position: index + 1,
      total
    }));
    return { total, farmers };
  }

  router.get('/me', (req, res) => {
    const login = (
      req.session?.twitchUser?.login ||
      req.session?.user?.login ||
      req.session?.user?.username ||
      ''
    ).toLowerCase();
    res.json({ ok: true, isAdmin: login === 'nico_moose', login });
  });

  router.use(requireAdmin);

  const shared = {
    db,
    parseAmount,
    clampInt,
    parseJsonSafe,
    normalizePlayerProfile: normalizeProfile,
    getProfileByLogin,
    updateFarmJsonLevel,
    updateFarmJsonParts,
    logAdminEvent,
    getProfileById,
    getStreamStatus,
    setSetting,
    setMarketStock,
    triggerWizebotLegacyFarmMigration,
    sayToChannel,
    listPlayerLogins,
    loadPlayerLogins: listPlayerLogins,
    loadFarmers,
    importLegacyFarmToSite,
    syncPlayerFromWizebot,
    pushPlayerToWizebot,
    saveFarmBackup,
    saveFarmObject,
    restoreFarmBackup,
    deepCloneSafe,
    stripAdminBackups,
    getAllProfiles,
    resetCaseCooldownOnly,
    resetRaidCooldownOnly,
    resetOffcollectCooldownOnly,
    resetGamusOnly,
    upsertTwitchUser,
    syncProfileToWizebot,
    sleep,
    fmtAdminLogin: sanitizeAdminLogin
  };

  registerAdminFieldAndLookupRoutes(router, shared);
  router.use(adminActionGuard);
  registerAdminSyncRoutes(router, shared);
  registerAdminMutationRoutes(router, shared);
  registerAdminToolsRoutes(router, shared);

  return router;
};
