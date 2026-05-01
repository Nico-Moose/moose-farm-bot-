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

  function getAllProfiles() {
    return db.prepare(`
      SELECT u.login, f.twitch_id, f.farm_balance
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      ORDER BY LOWER(u.login) ASC
    `).all();
  }

  function saveFarmObject(twitchId, farm) {
    db.prepare(`
      UPDATE farm_profiles
      SET farm_json = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(JSON.stringify(farm || {}), Date.now(), twitchId);
  }

  router.post('/transfer-farm', (req, res) => {
    const oldLogin = String(req.body.oldLogin || '').toLowerCase().replace(/^@/, '');
    const newLogin = String(req.body.newLogin || '').toLowerCase().replace(/^@/, '');
    if (!oldLogin || !newLogin || oldLogin === newLogin) return res.status(400).json({ ok: false, error: 'Нужен старый и новый ник' });
    const oldProfile = getProfileByLogin(db, oldLogin);
    const newProfile = getProfileByLogin(db, newLogin);
    if (!oldProfile) return res.status(404).json({ ok: false, error: 'Старая ферма не найдена' });
    if (!newProfile) return res.status(404).json({ ok: false, error: 'Новый игрок должен хотя бы раз войти на сайт через Twitch' });
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
    if (!login || !Number.isFinite(stock)) return res.status(400).json({ ok: false, error: 'Нужен login и stock' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const farm = profile.farm || {};
    farm.market = farm.market || {};
    farm.market.partsStock = stock;
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_set_market_stock', { stock });
    res.json({ ok: true, message: `Склад рынка установлен: ${stock}`, profile: getProfileByLogin(db, login) });
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
    delete farm.gamusLastClaimAt;
    delete farm.gamus_bonus_ts;
    farm.gamus = farm.gamus || {};
    farm.gamus.lastClaimAt = 0;
    saveFarmObject(profile.twitch_id, farm);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_gamus', {});
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
      { id: 'admin', title: 'Админ-действия' }
    ]});
  });

  return router;
};
