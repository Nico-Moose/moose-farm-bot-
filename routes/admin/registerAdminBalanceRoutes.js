module.exports = function registerAdminBalanceRoutes({
  router,
  db,
  parseAmount,
  getProfileByLogin,
  updateFarmJsonParts,
  logAdminEvent,
}) {
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
};
