module.exports = function registerAdminLevelRoutes(router, deps) {
  const { db, clampInt, getProfileByLogin, updateFarmJsonLevel, logAdminEvent } = deps;

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
};
