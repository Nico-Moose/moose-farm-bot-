const express = require("express");
const { requireAdmin } = require("../middleware/requireAdmin");

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

    const next = profile.upgrade_balance + amount;

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

  router.post("/reset-raid-cooldown", (req, res) => {
    const login = String(req.body.login || "").toLowerCase().replace(/^@/, "");

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: "Игрок не найден" });

    const farm = profile.farm || {};
    farm.raidCooldownUntil = 0;
    farm.lastRaidAt = 0;

    db.prepare(`
      UPDATE farm_profiles
      SET farm_json = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(JSON.stringify(farm), Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, "admin_reset_raid_cooldown", {});

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

  return router;
};
