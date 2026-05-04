const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { syncWizebotFarmToProfile } = require("../services/wizebotSyncService");
const { syncProfileToWizebot } = require("../services/wizebotApiService");
const { upsertTwitchUser, getProfile: getProfileById, updateProfile, logFarmEvent } = require("../services/userService");
const { getStreamStatus, setSetting } = require("../services/streamStatusService");
const { setMarketStock } = require("../services/farm/marketService");
const registerAdminSyncRoutes = require("./admin/registerAdminSyncRoutes");
const registerAdminBalanceRoutes = require("./admin/registerAdminBalanceRoutes");
const registerAdminBackupRoutes = require("./admin/registerAdminBackupRoutes");

function parseAmount(value) {
  if (typeof value === "number") return Math.trunc(value);

  let raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (!raw) return NaN;

  let sign = 1;
  if (raw.startsWith("+")) raw = raw.slice(1);
  if (raw.startsWith("-")) {
    sign = -1;
    raw = raw.slice(1);
  }

  const multipliers = [
    ["трлн", 1_000_000_000_000],
    ["млрд", 1_000_000_000],
    ["кк", 1_000_000],
    ["kk", 1_000_000],
    ["к", 1_000],
    ["k", 1_000],
  ];

  let multiplier = 1;
  for (const [suffix, mult] of multipliers) {
    if (raw.endsWith(suffix)) {
      multiplier = mult;
      raw = raw.slice(0, -suffix.length);
      break;
    }
  }

  const n = Number(raw.replace(",", "."));
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
    return JSON.parse(raw || "");
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
    turret: parseJsonSafe(row.turret_json, {}),
  };
}

function getProfileByLogin(db, login) {
  login = String(login || "").toLowerCase().replace(/^@/, "");

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

  db.prepare(`
    UPDATE farm_profiles
    SET farm_json = ?, updated_at = ?
    WHERE twitch_id = ?
  `).run(JSON.stringify(farm), Date.now(), twitchId);
}

function updateFarmJsonParts(db, twitchId, parts) {
  const row = db.prepare(`SELECT farm_json FROM farm_profiles WHERE twitch_id = ?`).get(twitchId);
  const farm = parseJsonSafe(row?.farm_json, {});

  farm.resources = farm.resources || {};
  farm.resources.parts = parts;

  db.prepare(`
    UPDATE farm_profiles
    SET farm_json = ?, updated_at = ?
    WHERE twitch_id = ?
  `).run(JSON.stringify(farm), Date.now(), twitchId);
}

function logAdminEvent(db, twitchId, type, payload) {
  try {
    db.prepare(`
      INSERT INTO farm_events (twitch_id, type, payload, created_at)
      VALUES (?, ?, ?, ?)
    `).run(twitchId, type, JSON.stringify(payload || {}), Date.now());
  } catch (_) {}
}




module.exports = function (db) {
  const router = express.Router();

  const listPlayersStmt = db.prepare(`
      SELECT u.login, u.display_name, f.level
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
      ORDER BY LOWER(u.login) ASC
      LIMIT 50
    `);
  const adminPlayersCache = new Map();


  const pendingAdminActions = new Set();

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
    const cacheKey = q;
    const now = Date.now();
    const cached = adminPlayersCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return cached.items;
    }

    const like = `${q}%`;
    const items = listPlayersStmt.all(q, like, like);
    adminPlayersCache.set(cacheKey, { items, expiresAt: now + 5000 });
    return items;
  }

  router.get("/me", (req, res) => {
    const login = (
      req.session?.twitchUser?.login ||
      req.session?.user?.login ||
      req.session?.user?.username ||
      ""
    ).toLowerCase();

    res.json({ ok: true, isAdmin: login === "nico_moose", login });
  });

  router.use(requireAdmin);

  registerAdminSyncRoutes(router, {
    db,
    getProfileByLogin,
    getProfileById,
    updateProfile,
    upsertTwitchUser,
    logAdminEvent,
    syncWizebotFarmToProfile,
    syncProfileToWizebot,
    saveFarmBackup
  });

  registerAdminBalanceRoutes(router, {
    db,
    getProfileByLogin,
    parseAmount,
    clampInt,
    updateFarmJsonLevel,
    updateFarmJsonParts,
    logAdminEvent,
    syncProfileToWizebot,
    saveFarmBackup
  });

  registerAdminBackupRoutes(router, {
    db,
    getProfileByLogin,
    upsertTwitchUser,
    setMarketStock,
    clampInt,
    logAdminEvent,
    saveFarmObject,
    saveFarmBackup,
    restoreFarmBackup,
    deepCloneSafe,
    getAllProfiles
  });


  // Admin: set one editable player field from profile preview
    router.post('/player/set-field', (req, res) => {
    try {
      const login = String(req.body?.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
      const field = String(req.body?.field || '').trim();
      const value = Number(req.body?.value ?? 0);

      if (!login || !field) return res.status(400).json({ ok: false, error: 'missing_login_or_field' });
      if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'invalid_number' });

      const allowed = new Set([
        'level','farm_balance','upgrade_balance','parts','license_level','raid_power','protection_level',
        'turret_level','turret_chance'
      ]);
      if (!allowed.has(field)) return res.status(400).json({ ok: false, error: 'field_not_allowed' });

      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'profile_not_found' });

      saveFarmBackup(profile, 'before_set_field_' + field);

      const farm = deepCloneSafe(profile.farm || {}, {});
      farm.resources = farm.resources || {};
      farm.buildings = farm.buildings || {};
      const turret = deepCloneSafe(profile.turret || {}, {});
      const now = Date.now();

      if (field === 'level') {
        const nextLevel = Math.max(0, Math.floor(value));
        farm.level = nextLevel;
        db.prepare(`UPDATE farm_profiles SET level=?, farm_json=?, updated_at=? WHERE twitch_id=?`)
          .run(nextLevel, JSON.stringify(farm), now, profile.twitch_id);
      } else if (field === 'farm_balance') {
        db.prepare(`UPDATE farm_profiles SET farm_balance=?, updated_at=? WHERE twitch_id=?`)
          .run(value, now, profile.twitch_id);
      } else if (field === 'upgrade_balance') {
        db.prepare(`UPDATE farm_profiles SET upgrade_balance=?, updated_at=? WHERE twitch_id=?`)
          .run(value, now, profile.twitch_id);
      } else if (field === 'parts') {
        farm.resources.parts = value;
        db.prepare(`UPDATE farm_profiles SET parts=?, farm_json=?, updated_at=? WHERE twitch_id=?`)
          .run(value, JSON.stringify(farm), now, profile.twitch_id);
      } else if (field === 'license_level') {
        db.prepare(`UPDATE farm_profiles SET license_level=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'raid_power') {
        db.prepare(`UPDATE farm_profiles SET raid_power=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'protection_level') {
        db.prepare(`UPDATE farm_profiles SET protection_level=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'turret_level') {
        turret.level = Math.max(0, Math.floor(value));
        db.prepare(`UPDATE farm_profiles SET turret_json=?, updated_at=? WHERE twitch_id=?`)
          .run(JSON.stringify(turret), now, profile.twitch_id);
      } else if (field === 'turret_chance') {
        turret.chance = Math.max(0, value);
        db.prepare(`UPDATE farm_profiles SET turret_json=?, updated_at=? WHERE twitch_id=?`)
          .run(JSON.stringify(turret), now, profile.twitch_id);
      }

      logAdminEvent(db, profile.twitch_id, 'admin_set_field', { login, field, value });
      return res.json({ ok: true, profile: getProfileByLogin(db, login) });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.use(adminActionGuard);

  router.get("/stream-status", async (req, res) => {
    const streamStatus = await getStreamStatus();
    res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online });
  });

  router.post("/stream-status", async (req, res) => {
    const mode = String(req.body?.mode || "auto").toLowerCase();
    const value = ["online", "true", "1"].includes(mode) ? "online" : (["offline", "false", "0"].includes(mode) ? "offline" : "auto");
    setSetting("stream_online_manual", value);
    const streamStatus = await getStreamStatus();
    logAdminEvent(db, req.session?.twitchUser?.id || "admin", "admin_stream_status", { mode: value, online: streamStatus.online });
    res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online, message: `Статус стрима: ${value}` });
  });



  router.get("/players", (req, res) => {
    res.json({ ok: true, players: listPlayerLogins(req.query.prefix || '') });
  });

  router.get("/player/:nick", (req, res) => {
    const profile = getProfileByLogin(db, req.params.nick);

    if (!profile) {
      return res.status(404).json({
        ok: false,
        error: "Игрок не найден. Он должен хотя бы раз войти на сайт через Twitch."
      });
    }

    res.json({ ok: true, profile });
  });


  router.post("/import-legacy-farm", async (req, res) => {
    try {
      const login = String(req.body?.login || "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
      if (!login) return res.status(400).json({ ok: false, error: "Укажи ник игрока" });

      const data = await importLegacyFarmToSite(login, 'admin_import_legacy_farm');
      if (!data.ok) {
        return res.status(400).json({
          ok: false,
          error: data.error || "Не удалось перенести старую ферму в farm_v2"
        });
      }

      return res.json({
        ok: true,
        message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`,
        profile: data.profile,
        imported: data.imported || null,
        pushBack: data.pushBack || null
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post("/sync-from-wizebot", async (req, res) => {
    try {
      const login = String(req.body?.login || "").toLowerCase().replace(/^@/, "");
      if (!login) return res.status(400).json({ ok: false, error: "Укажи ник игрока" });

      const data = await importLegacyFarmToSite(login, 'admin_sync_from_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || "Не удалось импортировать игрока из WizeBot" });

      return res.json({
        ok: true,
        message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`,
        profile: data.profile,
        imported: data.imported || null
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post("/push-to-wizebot", async (req, res) => {
    try {
      const login = String(req.body?.login || "").toLowerCase().replace(/^@/, "");
      if (!login) return res.status(400).json({ ok: false, error: "Укажи ник игрока" });

      const data = await pushPlayerToWizebot(login, 'admin_push_to_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || "Не удалось отправить игрока в WizeBot" });

      return res.json({
        ok: true,
        message: `Игрок ${login} отправлен в WizeBot`,
        profile: data.profile,
        result: data.result || null
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post("/sync-harvest-from-wizebot", async (req, res) => {
    try {
      const login = String(req.body?.login || "").toLowerCase().replace(/^@/, "");
      if (!login) return res.status(400).json({ ok: false, error: "Укажи ник игрока" });

      const data = await syncPlayerFromWizebot(login, 'admin_sync_harvest_from_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || "Не удалось подтянуть урожай из WizeBot" });

      return res.json({
        ok: true,
        message: `Урожай игрока ${login} подтянут из WizeBot`,
        profile: data.profile,
        imported: data.imported || null
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

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
  if (cleanFarm && typeof cleanFarm === 'object' && cleanFarm.adminBackups) {
    delete cleanFarm.adminBackups;
  }
  return cleanFarm;
}

function saveFarmObject(twitchId, farm) {
  const cleanFarm = deepCloneSafe(farm || {}, {});
  db.prepare(`
    UPDATE farm_profiles
    SET farm_json = ?, updated_at = ?
    WHERE twitch_id = ?
  `).run(JSON.stringify(cleanFarm), Date.now(), twitchId);
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

  const restoredFarm = deepCloneSafe(backup.farm || {}, {});
  restoredFarm.adminBackups = backups;

  db.prepare(`
    UPDATE farm_profiles
    SET
      level=?,
      farm_balance=?,
      upgrade_balance=?,
      total_income=?,
      parts=?,
      last_collect_at=?,
      farm_json=?,
      configs_json=?,
      license_level=?,
      protection_level=?,
      raid_power=?,
      turret_json=?,
      updated_at=?
    WHERE twitch_id=?
  `).run(
    Number(backup.level || 0),
    Number(backup.farm_balance || 0),
    Number(backup.upgrade_balance || 0),
    Number(backup.total_income || 0),
    Number(backup.parts || 0),
    backup.last_collect_at || null,
    JSON.stringify(restoredFarm),
    JSON.stringify(deepCloneSafe(backup.configs || {}, {})),
    Number(backup.license_level || 0),
    Number(backup.protection_level || 0),
    Number(backup.raid_power || 0),
    JSON.stringify(deepCloneSafe(backup.turret || {}, {})),
    Date.now(),
    profile.twitch_id
  );

  return backup;
}

  return router;
};