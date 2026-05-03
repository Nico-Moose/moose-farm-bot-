const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");
const { syncWizebotFarmToProfile } = require("../services/wizebotSyncService");
const { syncProfileToWizebot } = require("../services/wizebotApiService");
const { upsertTwitchUser, getProfile: getProfileById, updateProfile, logFarmEvent } = require("../services/userService");
const { getStreamStatus, setSetting } = require("../services/streamStatusService");
const { setMarketStock } = require("../services/farm/marketService");

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


  // Admin: set one editable player field from profile preview
  router.post('/player/set-field', (req, res) => {
    try {
      const login = normalizeLogin(req.body.login);
      const field = String(req.body.field || '').trim();
      const valueRaw = req.body.value;

      if (!login || !field) return res.status(400).json({ ok: false, error: 'missing_login_or_field' });

      const allowed = new Set([
        'level','farm_balance','upgrade_balance','parts','license_level','raid_power','protection_level',
        'turret_level','turret_chance'
      ]);

      if (!allowed.has(field)) return res.status(400).json({ ok: false, error: 'field_not_allowed' });

      const db = getDb();
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'profile_not_found' });

      const farm = deepCloneSafe(profile.farm || {}, {});
      farm.resources = farm.resources || {};
      farm.buildings = farm.buildings || {};

      createAdminBackup(db, profile, `set_field_${field}`);

      const value = Number(valueRaw || 0);
      if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'invalid_number' });

      if (field === 'level') {
        db.prepare(`UPDATE farm_profiles SET level=?, updated_at=? WHERE twitch_id=?`).run(Math.max(0, Math.floor(value)), Date.now(), profile.twitch_id);
        farm.level = Math.max(0, Math.floor(value));
      } else if (field === 'farm_balance') {
        db.prepare(`UPDATE farm_profiles SET farm_balance=?, updated_at=? WHERE twitch_id=?`).run(value, Date.now(), profile.twitch_id);
      } else if (field === 'upgrade_balance') {
        db.prepare(`UPDATE farm_profiles SET upgrade_balance=?, updated_at=? WHERE twitch_id=?`).run(value, Date.now(), profile.twitch_id);
      } else if (field === 'license_level') {
        db.prepare(`UPDATE farm_profiles SET license_level=?, updated_at=? WHERE twitch_id=?`).run(Math.max(0, Math.floor(value)), Date.now(), profile.twitch_id);
      } else if (field === 'raid_power') {
        db.prepare(`UPDATE farm_profiles SET raid_power=?, updated_at=? WHERE twitch_id=?`).run(Math.max(0, Math.floor(value)), Date.now(), profile.twitch_id);
      } else if (field === 'protection_level') {
        db.prepare(`UPDATE farm_profiles SET protection_level=?, updated_at=? WHERE twitch_id=?`).run(Math.max(0, Math.floor(value)), Date.now(), profile.twitch_id);
      } else if (field === 'parts') {
        farm.resources.parts = value;
        db.prepare(`UPDATE farm_profiles SET farm_json=?, updated_at=? WHERE twitch_id=?`).run(JSON.stringify(farm), Date.now(), profile.twitch_id);
      } else if (field === 'turret_level' || field === 'turret_chance') {
        const currentTurret = deepCloneSafe(profile.turret || {}, {});
        if (field === 'turret_level') currentTurret.level = Math.max(0, Math.floor(value));
        if (field === 'turret_chance') currentTurret.chance = Math.max(0, value);
        db.prepare(`UPDATE farm_profiles SET turret_json=?, updated_at=? WHERE twitch_id=?`).run(JSON.stringify(currentTurret), Date.now(), profile.twitch_id);
      }

      logAdminAction(db, 'set_field', login, { field, value });
      const updated = getProfileByLogin(db, login);
      return res.json({ ok: true, profile: adminProfileView(updated) });
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


  async function syncPlayerFromWizebot(login, source = 'admin_sync_from_wizebot') {
    login = String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
    if (!login) return { ok: false, error: 'Укажи ник игрока' };

    let profile = getProfileByLogin(db, login);

    // ВАЖНО: импорт из WizeBot должен работать даже если игрок ещё не заходил на сайт.
    // Создаём локальную карточку игрока с техническим twitch_id.
    if (!profile) {
      upsertTwitchUser({
        id: `wizebot:${login}`,
        login,
        display_name: login,
        profile_image_url: ''
      });
      profile = getProfileByLogin(db, login);
    }

    if (!profile) return { ok: false, error: 'Не удалось создать профиль игрока на сайте' };

    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (!result.ok) return result;

    const updatedProfile = updateProfile({ ...profile, ...result.profile, twitch_id: profile.twitch_id });
    logAdminEvent(db, profile.twitch_id, source, { login, imported: result.imported || null });
    return { ok: true, profile: updatedProfile, imported: result.imported || null };
  }

  async function pushPlayerToWizebot(login, source = 'admin_push_to_wizebot') {
    const profile = getProfileByLogin(db, login);
    if (!profile) return { ok: false, error: 'Игрок не найден' };
    const result = await syncProfileToWizebot(profile);
    logAdminEvent(db, profile.twitch_id, source, { login, result });
    return { ok: true, profile: getProfileById(profile.twitch_id), result };
  }

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

  router.post("/give-farm-balance", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: "Нужен login и amount" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    const next = profile.farm_balance + amount;

    db.prepare(`
      UPDATE farm_profiles
      SET farm_balance = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_farm_balance", { amount, next });

    res.json({
      ok: true,
      message: `Фермерский баланс изменён на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/give-upgrade-balance", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: "Нужен login и amount" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    const next = Math.max(0, profile.upgrade_balance + amount);

    db.prepare(`
      UPDATE farm_profiles
      SET upgrade_balance = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_upgrade_balance", { amount, next });

    res.json({
      ok: true,
      message: `Бонусный баланс изменён на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/give-parts", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: "Нужен login и amount" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    const next = Math.max(0, profile.parts + amount);

    db.prepare(`
      UPDATE farm_profiles
      SET parts = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    updateFarmJsonParts(db, profile.twitch_id, next);
    logAdminEvent(db, profile.twitch_id, "admin_parts", { amount, next });

    res.json({
      ok: true,
      message: `Запчасти изменены на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/set-level", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const level = clampInt(req.body.level, 0, 120);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: "Нужен login и level 0-120" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    db.prepare(`
      UPDATE farm_profiles
      SET level = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    updateFarmJsonLevel(db, profile.twitch_id, level);
    logAdminEvent(db, profile.twitch_id, "admin_set_level", { level });

    res.json({
      ok: true,
      message: `Уровень фермы установлен: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/set-protection", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const level = clampInt(req.body.level, 0, 120);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: "Нужен login и level 0-120" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    db.prepare(`
      UPDATE farm_profiles
      SET protection_level = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_set_protection", { level });

    res.json({
      ok: true,
      message: `Защита установлена: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/set-raid-power", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");
    const level = clampInt(req.body.level, 0, 200);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: "Нужен login и level 0-200" });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    db.prepare(`
      UPDATE farm_profiles
      SET raid_power = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_set_raid_power", { level });

    res.json({
      ok: true,
      message: `Рейд-сила установлена: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/reset-raid-cooldown", async (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    const farm = profile.farm || {};
    farm.raidCooldownUntil = 0;
    farm.lastRaidAt = 0;
    farm.shieldUntil = 0;
    farm.shield_until = 0;

    db.prepare(`
      UPDATE farm_profiles
      SET farm_json = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(JSON.stringify(farm), Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_reset_raid_cooldown", {});

    try {
      await syncProfileToWizebot(getProfileByLogin(db, login));
    } catch (error) {
      console.error('[ADMIN RESET RAID COOLDOWN PUSH] Error:', error);
    }

    res.json({
      ok: true,
      message: `КД рейда сброшен для ${login}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/delete-buildings", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    saveFarmBackup(profile, 'before_delete_buildings');
    const farm = profile.farm || {};
    farm.buildings = {};

    db.prepare(`
      UPDATE farm_profiles
      SET farm_json = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(JSON.stringify(farm), Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_delete_buildings", {});

    res.json({
      ok: true,
      message: `Постройки удалены у ${login}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post("/delete-farm", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    saveFarmBackup(profile, 'before_delete_farm');

    db.prepare(`
      UPDATE farm_profiles
      SET
        level = 0,
        farm_balance = 0,
        upgrade_balance = 0,
        total_income = 0,
        parts = 0,
        last_collect_at = ?,
        farm_json = '{}',
        license_level = 0,
        protection_level = 0,
        raid_power = 0,
        turret_json = '{}',
        updated_at = ?
      WHERE twitch_id = ?
    `).run(Date.now(), Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_delete_farm", {});

    res.json({
      ok: true,
      message: `Ферма ${login} сброшена`,
      profile: getProfileByLogin(db, login)
    });
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

  function restoreFarmBackup(profile) {
    const farm = profile?.farm || {};
    const backups = Array.isArray(farm.adminBackups) ? farm.adminBackups : [];
    const backup = backups[0];
    if (!backup) return null;
    const restoredFarm = backup.farm || {};
    restoredFarm.adminBackups = backups;
    db.prepare(`UPDATE farm_profiles SET level=?, farm_balance=?, upgrade_balance=?, total_income=?, parts=?, last_collect_at=?, farm_json=?, configs_json=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=? WHERE twitch_id=?`).run(
      Number(backup.level || 0), Number(backup.farm_balance || 0), Number(backup.upgrade_balance || 0), Number(backup.total_income || 0), Number(backup.parts || 0), backup.last_collect_at || null, JSON.stringify(restoredFarm), JSON.stringify(backup.configs || {}), Number(backup.license_level || 0), Number(backup.protection_level || 0), Number(backup.raid_power || 0), JSON.stringify(backup.turret || {}), Date.now(), profile.twitch_id
    );
    return backup;
  }

  router.post('/transfer-farm', (req, res) => {
    const oldLogin = String(req.body.oldLogin || '').toLowerCase().replace(/^@/, '');
    const newLogin = String(req.body.newLogin || '').toLowerCase().replace(/^@/, '');
    if (!oldLogin || !newLogin || oldLogin === newLogin) return res.status(400).json({ ok: false, error: 'Нужен старый и новый ник' });
    const oldProfile = getProfileByLogin(db, oldLogin);
    const newProfile = getProfileByLogin(db, newLogin);
    if (!oldProfile) return res.status(404).json({ ok: false, error: 'Старая ферма не найдена' });
    if (!newProfile) return res.status(404).json({ ok: false, error: 'Новый игрок должен хотя бы раз войти на сайт через Twitch' });
    saveFarmBackup(oldProfile, 'before_transfer_from');
    saveFarmBackup(newProfile, 'before_transfer_to');
    const farm = oldProfile.farm || {};
    farm.owner = newLogin;
    db.prepare(`UPDATE farm_profiles SET level=?, farm_balance=?, upgrade_balance=?, total_income=?, parts=?, last_collect_at=?, farm_json=?, configs_json=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=? WHERE twitch_id=?`).run(oldProfile.level, oldProfile.farm_balance + newProfile.farm_balance, oldProfile.upgrade_balance + newProfile.upgrade_balance, oldProfile.total_income + newProfile.total_income, oldProfile.parts + newProfile.parts, oldProfile.last_collect_at || newProfile.last_collect_at || null, JSON.stringify(farm), JSON.stringify(oldProfile.configs || newProfile.configs || {}), Math.max(oldProfile.license_level || 0, newProfile.license_level || 0), Math.max(oldProfile.protection_level || 0, newProfile.protection_level || 0), Math.max(oldProfile.raid_power || 0, newProfile.raid_power || 0), JSON.stringify(oldProfile.turret || newProfile.turret || {}), Date.now(), newProfile.twitch_id);
    db.prepare(`UPDATE farm_profiles SET level=0, farm_balance=0, upgrade_balance=0, total_income=0, parts=0, last_collect_at=?, farm_json='{}', license_level=0, protection_level=0, raid_power=0, turret_json='{}', updated_at=? WHERE twitch_id=?`).run(Date.now(), Date.now(), oldProfile.twitch_id);
    logAdminEvent(db, newProfile.twitch_id, 'admin_transfer_farm', { oldLogin, newLogin });
    res.json({ ok: true, message: `Ферма перенесена: ${oldLogin} -> ${newLogin}`, profile: getProfileByLogin(db, newLogin) });
  });

  router.post('/set-market-stock', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const stock = clampInt(req.body.stock, 0, 2000000000);
    if (!Number.isFinite(stock)) return res.status(400).json({ ok: false, error: 'Нужен stock' });
    const market = setMarketStock(stock);
    let profile = null;
    if (login) profile = getProfileByLogin(db, login);
    logAdminEvent(db, profile ? profile.twitch_id : 'admin', 'admin_set_market_stock', { stock, global: true });
    res.json({ ok: true, message: `Общий склад рынка установлен: ${stock}`, market, profile });
  });

  router.post('/clear-debt', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (login) {
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
      const debt = Math.min(0, profile.farm_balance);
      if (debt < 0) db.prepare(`UPDATE farm_profiles SET farm_balance=0, updated_at=? WHERE twitch_id=?`).run(Date.now(), profile.twitch_id);
      logAdminEvent(db, profile.twitch_id, 'admin_clear_debt', { cleared: Math.abs(debt) });
      return res.json({ ok: true, message: debt < 0 ? `Долг ${login} списан: ${Math.abs(debt)}` : `У ${login} нет долга`, profile: getProfileByLogin(db, login) });
    }
    let count = 0;
    let total = 0;
    for (const row of getAllProfiles()) {
      const bal = Number(row.farm_balance || 0);
      if (bal < 0) {
        count++;
        total += Math.abs(bal);
        db.prepare(`UPDATE farm_profiles SET farm_balance=0, updated_at=? WHERE twitch_id=?`).run(Date.now(), row.twitch_id);
        logAdminEvent(db, row.twitch_id, 'admin_clear_debt', { cleared: Math.abs(bal), mass: true });
      }
    }
    res.json({ ok: true, message: `Списаны долги: игроков ${count}, сумма ${total}` });
  });

  router.post('/reset-gamus', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    const farm = profile.farm || {};

    // Реальный кулдаун GAMUS считается из profile.farm.lastGamusAt.
    // Старый вариант сбрасывал farm.gamus.lastClaimAt, но сервис его не использует.
    farm.lastGamusAt = 0;

    // Совместимость со старыми/промежуточными ключами.
    delete farm.gamusLastClaimAt;
    delete farm.gamus_bonus_ts;
    if (farm.gamus) farm.gamus.lastClaimAt = 0;

    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_gamus', { resetLastGamusAt: true });
    res.json({ ok: true, message: `GAMUS сброшен для ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/reset-cases', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const resetOne = (profile) => {
      const farm = profile.farm || {};
      farm.caseStats = { opened: 0, spent: 0, coins: 0, parts: 0 };
      farm.cases = farm.cases || {};
      farm.cases.opened = 0;
      farm.cases.totalSpent = 0;
      farm.cases.totalCoins = 0;
      farm.cases.totalParts = 0;
      farm.lastCaseAt = 0;
      farm.caseCooldownUntil = 0;
      saveFarmObject(profile.twitch_id, farm);
      logAdminEvent(db, profile.twitch_id, 'admin_reset_cases', { login: profile.login });
    };
    if (login) {
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
      resetOne(profile);
      return res.json({ ok: true, message: `Кейсы сброшены для ${login}`, profile: getProfileByLogin(db, login) });
    }
    let count = 0;
    for (const row of getAllProfiles()) {
      const profile = getProfileByLogin(db, row.login);
      if (profile) { resetOne(profile); count++; }
    }
    res.json({ ok: true, message: `Кейсы сброшены всем игрокам: ${count}` });
  });

  router.post('/delete-turret', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    saveFarmBackup(profile, 'before_delete_turret');
    db.prepare(`UPDATE farm_profiles SET turret_json='{}', updated_at=? WHERE twitch_id=?`).run(Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_delete_turret', { login });
    res.json({ ok: true, message: `Турель удалена у ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/restore-backup', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const backup = restoreFarmBackup(profile);
    if (!backup) return res.status(404).json({ ok: false, error: 'Бэкап не найден. Бэкап создаётся перед переносом/удалением/опасными действиями.' });
    logAdminEvent(db, profile.twitch_id, 'admin_restore_backup', { login, backupAt: backup.createdAt, reason: backup.reason });
    res.json({ ok: true, message: `Бэкап восстановлен для ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/set-roulette-tickets', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = clampInt(req.body.amount, 0, 150);
    if (!login || !Number.isFinite(amount)) return res.status(400).json({ ok: false, error: 'Нужен login и amount 0-150' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const farm = profile.farm || {};
    farm.roulette = farm.roulette || {};
    farm.roulette.tickets = amount;
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_set_roulette_tickets', { login, tickets: amount });
    res.json({ ok: true, message: `Билеты рулетки установлены: ${amount}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/run-1to1-check', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const farm = profile.farm || {};
    const report = {
      login,
      generatedAt: Date.now(),
      resources: { level: profile.level, farm_balance: profile.farm_balance, upgrade_balance: profile.upgrade_balance, parts: profile.parts, license_level: profile.license_level, raid_power: profile.raid_power, protection_level: profile.protection_level, turret_level: Number(profile.turret?.level || 0) },
      checks: [
        { id: 'upgrade', title: 'Стоимость апов', status: 'manual', note: 'Сравнить следующий ап с WizeBot !ап.' },
        { id: 'buildings', title: 'Стоимость зданий', status: 'manual', note: 'Сравнить покупку/ап каждого здания с WizeBot.' },
        { id: 'income', title: 'Доход зданий', status: 'manual', note: 'Сравнить инфо фермы/сбор/оффсбор.' },
        { id: 'raids', title: 'Рейды', status: 'manual', note: 'Проверить цель, силу, защиту, турель, лог.' },
        { id: 'market', title: 'Рынок', status: 'manual', note: 'Проверить покупку/продажу и склад.' },
        { id: 'cases', title: 'Кейсы', status: 'manual', note: 'Проверить цену, множитель, кулдаун, историю.' },
        { id: 'gamus', title: 'GAMUS', status: 'manual', note: 'Проверить диапазон награды и ресет 06:00 МСК.' },
        { id: 'offcollect', title: 'Оффсбор', status: 'manual', note: 'Проверить 50% дохода и КД.' },
        { id: 'admin', title: 'Админ-действия', status: 'manual', note: 'Проверить изменение ресурсов, сбросы, бэкап.' }
      ],
      buildings: farm.buildings || {},
      case: { lastCaseAt: farm.lastCaseAt || 0, historyCount: Array.isArray(farm.caseHistory) ? farm.caseHistory.length : 0 },
      gamus: { lastGamusAt: farm.lastGamusAt || 0 },
      roulette: farm.roulette || { tickets: 0 },
      backups: Array.isArray(farm.adminBackups) ? farm.adminBackups.map((b) => ({ createdAt: b.createdAt, reason: b.reason, login: b.login })).slice(0, 10) : []
    };
    logAdminEvent(db, profile.twitch_id, 'admin_1to1_check', { login });
    res.json({ ok: true, message: `Чеклист 1:1 сформирован для ${login}`, report });
  });

  router.get('/events', (req, res) => {
    const login = String(req.query.login || '').toLowerCase().replace(/^@/, '');
    const type = String(req.query.type || '').trim();
    const limit = Math.min(300, Math.max(1, parseInt(req.query.limit || '120', 10) || 120));
    const params = [];
    let where = '1=1';
    if (login) {
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.json({ ok: true, events: [] });
      where += ' AND e.twitch_id = ?';
      params.push(profile.twitch_id);
    }
    if (type) { where += ' AND e.type = ?'; params.push(type); }
    params.push(limit);
    const events = db.prepare(`SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at FROM farm_events e LEFT JOIN twitch_users u ON u.twitch_id=e.twitch_id WHERE ${where} ORDER BY e.created_at DESC LIMIT ?`).all(...params).map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
    res.json({ ok: true, events });
  });

  router.get('/checklist', (req, res) => {
    res.json({ ok: true, checks: [
      { id: 'upgrade', title: 'Ап фермы' },
      { id: 'buildings', title: 'Ап/покупка зданий' },
      { id: 'market', title: 'Рынок' },
      { id: 'raids', title: 'Рейды' },
      { id: 'cases', title: 'Кейсы' },
      { id: 'gamus', title: 'GAMUS' },
      { id: 'offcollect', title: 'Оффсбор' },
      { id: 'admin', title: 'Админ-действия' },
      { id: 'overlay', title: 'Overlay кейса' },
      { id: 'rare_admin', title: 'Редкие админ-команды' }
    ]});
  });


  // === STAGE 7-12: backup list / preview / targeted restore ===
  router.get('/backups', (req, res) => {
    const login = String(req.query.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const backups = Array.isArray(profile.farm?.adminBackups) ? profile.farm.adminBackups : [];
    res.json({
      ok: true,
      login,
      backups: backups.map((b, index) => ({
        index,
        createdAt: b.createdAt || 0,
        reason: b.reason || 'backup',
        login: b.login || login,
        level: Number(b.level || 0),
        farm_balance: Number(b.farm_balance || 0),
        upgrade_balance: Number(b.upgrade_balance || 0),
        parts: Number(b.parts || 0),
        license_level: Number(b.license_level || 0),
        protection_level: Number(b.protection_level || 0),
        raid_power: Number(b.raid_power || 0),
        buildings: (b.farm && b.farm.buildings) || {},
        caseHistoryCount: Array.isArray(b.farm?.caseHistory) ? b.farm.caseHistory.length : 0,
        raidLogsCount: Array.isArray(b.farm?.raidLogs) ? b.farm.raidLogs.length : 0
      }))
    });
  });

  router.post('/restore-backup-index', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const index = Math.max(0, parseInt(req.body.index || '0', 10) || 0);
    const block = String(req.body.block || 'all');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const backups = Array.isArray(profile.farm?.adminBackups) ? profile.farm.adminBackups : [];
    const backup = backups[index];
    if (!backup) return res.status(404).json({ ok: false, error: 'Бэкап не найден' });

    saveFarmBackup(profile, 'before_restore_backup_index_' + index + '_' + block);

    if (block === 'balances') {
      db.prepare(`UPDATE farm_profiles SET farm_balance=?, upgrade_balance=?, parts=?, updated_at=? WHERE twitch_id=?`).run(
        Number(backup.farm_balance || 0), Number(backup.upgrade_balance || 0), Number(backup.parts || 0), Date.now(), profile.twitch_id
      );
    } else if (block === 'progression') {
      db.prepare(`UPDATE farm_profiles SET level=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=? WHERE twitch_id=?`).run(
        Number(backup.level || 0), Number(backup.license_level || 0), Number(backup.protection_level || 0), Number(backup.raid_power || 0), JSON.stringify(deepCloneSafe(backup.turret || {}, {})), Date.now(), profile.twitch_id
      );
    } else if (block === 'farm') {
      const restoredFarm = deepCloneSafe(backup.farm || {}, {});
      restoredFarm.adminBackups = backups;
      db.prepare(`UPDATE farm_profiles SET farm_json=?, updated_at=? WHERE twitch_id=?`).run(JSON.stringify(restoredFarm), Date.now(), profile.twitch_id);
    } else if (block === 'buildings' || block === 'raids' || block === 'cases') {
      const currentFarm = deepCloneSafe(profile.farm || {}, {});
      const backupFarm = deepCloneSafe(backup.farm || {}, {});
      if (block === 'buildings') currentFarm.buildings = deepCloneSafe(backupFarm.buildings || {}, {});
      if (block === 'raids') {
        currentFarm.raidLogs = Array.isArray(backupFarm.raidLogs) ? backupFarm.raidLogs : [];
        currentFarm.lastRaidAt = backupFarm.lastRaidAt || 0;
        currentFarm.raidCooldownUntil = backupFarm.raidCooldownUntil || 0;
        currentFarm.shieldUntil = backupFarm.shieldUntil || 0;
      }
      if (block === 'cases') {
        currentFarm.caseHistory = Array.isArray(backupFarm.caseHistory) ? backupFarm.caseHistory : [];
        currentFarm.caseStats = deepCloneSafe(backupFarm.caseStats || {}, {});
        currentFarm.lastCaseAt = backupFarm.lastCaseAt || 0;
        currentFarm.caseCooldownUntil = backupFarm.caseCooldownUntil || 0;
      }
      currentFarm.adminBackups = backups;
      db.prepare(`UPDATE farm_profiles SET farm_json=?, updated_at=? WHERE twitch_id=?`).run(JSON.stringify(currentFarm), Date.now(), profile.twitch_id);
    } else {
      const restoredFarm = deepCloneSafe(backup.farm || {}, {});
      restoredFarm.adminBackups = backups;
      db.prepare(`UPDATE farm_profiles SET level=?, farm_balance=?, upgrade_balance=?, total_income=?, parts=?, last_collect_at=?, farm_json=?, configs_json=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=? WHERE twitch_id=?`).run(
        Number(backup.level || 0), Number(backup.farm_balance || 0), Number(backup.upgrade_balance || 0), Number(backup.total_income || 0), Number(backup.parts || 0), backup.last_collect_at || null, JSON.stringify(restoredFarm), JSON.stringify(deepCloneSafe(backup.configs || {}, {})), Number(backup.license_level || 0), Number(backup.protection_level || 0), Number(backup.raid_power || 0), JSON.stringify(deepCloneSafe(backup.turret || {}, {})), Date.now(), profile.twitch_id
      );
    }
    logAdminEvent(db, profile.twitch_id, 'admin_restore_backup_index', { login, index, block, backupAt: backup.createdAt, reason: backup.reason });
    res.json({ ok: true, message: `Восстановлен backup #${index + 1} (${block}) для ${login}`, profile: getProfileByLogin(db, login) });
  });

  return router;
};
