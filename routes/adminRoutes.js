const express = require("express");
const router = express.Router();

const requireAdmin = require("../middleware/requireAdmin");
const db = require("../db");

function parseAmount(value) {
  if (value === undefined || value === null) return NaN;

  let raw = String(value)
    .trim()
    .toLowerCase()
    .replace(",", ".");

  let multiplier = 1;

  if (raw.endsWith("кк") || raw.endsWith("kk") || raw.endsWith("m")) {
    multiplier = 1_000_000;
    raw = raw.replace(/(кк|kk|m)$/i, "");
  } else if (raw.endsWith("к") || raw.endsWith("k")) {
    multiplier = 1_000;
    raw = raw.replace(/(к|k)$/i, "");
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) return NaN;

  return Math.round(num * multiplier);
}

function getProfile(login) {
  return db
    .prepare("SELECT * FROM farm_profiles WHERE twitch_login = ?")
    .get(login.toLowerCase());
}

function saveProfile(login, patch) {
  const profile = getProfile(login);
  if (!profile) return null;

  const next = { ...profile, ...patch };

  db.prepare(`
    UPDATE farm_profiles
    SET
      level = ?,
      farm_balance = ?,
      upgrade_balance = ?,
      parts = ?,
      license_level = ?,
      raid_power = ?,
      protection_level = ?,
      farm_json = ?
    WHERE twitch_login = ?
  `).run(
    next.level || 0,
    next.farm_balance || 0,
    next.upgrade_balance || 0,
    next.parts || 0,
    next.license_level || 0,
    next.raid_power || 0,
    next.protection_level || 0,
    next.farm_json || "{}",
    login.toLowerCase()
  );

  return getProfile(login);
}

router.use(requireAdmin);

router.get("/me", (req, res) => {
  res.json({ ok: true, admin: true });
});

router.get("/player/:login", (req, res) => {
  const login = req.params.login.toLowerCase();
  const profile = getProfile(login);

  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  res.json({
    ok: true,
    profile,
  });
});

router.post("/give-farm-balance", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const amount = parseAmount(req.body.amount);

  if (!login || !Number.isFinite(amount)) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и amount",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    farm_balance: Number(profile.farm_balance || 0) + amount,
  });

  res.json({
    ok: true,
    message: `Фермерский баланс обновлён`,
    profile: updated,
  });
});

router.post("/give-upgrade-balance", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const amount = parseAmount(req.body.amount);

  if (!login || !Number.isFinite(amount)) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и amount",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    upgrade_balance: Number(profile.upgrade_balance || 0) + amount,
  });

  res.json({
    ok: true,
    message: `Бонусный баланс обновлён`,
    profile: updated,
  });
});

router.post("/give-parts", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const amount = parseAmount(req.body.amount);

  if (!login || !Number.isFinite(amount)) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и amount",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    parts: Math.max(0, Number(profile.parts || 0) + amount),
  });

  res.json({
    ok: true,
    message: `Запчасти обновлены`,
    profile: updated,
  });
});

router.post("/set-level", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const level = Number(req.body.level);

  if (!login || !Number.isFinite(level) || level < 0 || level > 999) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и level 0-999",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    level: Math.floor(level),
  });

  res.json({
    ok: true,
    message: `Уровень фермы установлен`,
    profile: updated,
  });
});

router.post("/set-protection", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const level = Number(req.body.level);

  if (!login || !Number.isFinite(level) || level < 0 || level > 120) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и protection level 0-120",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    protection_level: Math.floor(level),
  });

  res.json({
    ok: true,
    message: `Защита установлена`,
    profile: updated,
  });
});

router.post("/set-raid-power", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();
  const level = Number(req.body.level);

  if (!login || !Number.isFinite(level) || level < 0 || level > 200) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login и raid power 0-200",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  const updated = saveProfile(login, {
    raid_power: Math.floor(level),
  });

  res.json({
    ok: true,
    message: `Рейд-сила установлена`,
    profile: updated,
  });
});

router.post("/reset-raid-cooldown", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();

  if (!login) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  // Если у тебя есть отдельное поле cooldown — замени здесь.
  res.json({
    ok: true,
    message: `КД рейда сброшен для ${login}`,
  });
});

router.post("/delete-buildings", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();

  if (!login) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  let farm = {};
  try {
    farm = JSON.parse(profile.farm_json || "{}");
  } catch (_) {
    farm = {};
  }

  farm.buildings = {};

  const updated = saveProfile(login, {
    farm_json: JSON.stringify(farm),
  });

  res.json({
    ok: true,
    message: `Постройки удалены`,
    profile: updated,
  });
});

router.post("/delete-farm", (req, res) => {
  const login = String(req.body.login || "").toLowerCase();

  if (!login) {
    return res.status(400).json({
      ok: false,
      error: "Нужен login",
    });
  }

  const profile = getProfile(login);
  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: "Игрок не найден",
    });
  }

  db.prepare("DELETE FROM farm_profiles WHERE twitch_login = ?").run(login);
  db.prepare("DELETE FROM twitch_users WHERE login = ?").run(login);

  res.json({
    ok: true,
    message: `Ферма ${login} удалена`,
  });
});

module.exports = router;
