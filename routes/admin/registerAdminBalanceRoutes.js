module.exports = function registerAdminBalanceRoutes(router, ctx) {
  const {
    db,
    getProfileByLogin,
    parseAmount,
    clampInt,
    updateFarmJsonLevel,
    updateFarmJsonParts,
    logAdminEvent,
    syncProfileToWizebot,
    saveFarmBackup
  } = ctx;

  router.post('/give-farm-balance', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    const next = profile.farm_balance + amount;

    db.prepare(`
      UPDATE farm_profiles
      SET farm_balance = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, 'admin_farm_balance', { amount, next });

    res.json({
      ok: true,
      message: `Фермерский баланс изменён на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/give-upgrade-balance', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    const next = Math.max(0, profile.upgrade_balance + amount);

    db.prepare(`
      UPDATE farm_profiles
      SET upgrade_balance = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, 'admin_upgrade_balance', { amount, next });

    res.json({
      ok: true,
      message: `Бонусный баланс изменён на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/give-parts', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);

    if (!login || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    const next = Math.max(0, profile.parts + amount);

    db.prepare(`
      UPDATE farm_profiles
      SET parts = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(next, Date.now(), profile.twitch_id);

    updateFarmJsonParts(db, profile.twitch_id, next);
    logAdminEvent(db, profile.twitch_id, 'admin_parts', { amount, next });

    res.json({
      ok: true,
      message: `Запчасти изменены на ${amount}. Теперь: ${next}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/set-level', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 120);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и level 0-120' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    db.prepare(`
      UPDATE farm_profiles
      SET level = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    updateFarmJsonLevel(db, profile.twitch_id, level);
    logAdminEvent(db, profile.twitch_id, 'admin_set_level', { level });

    res.json({
      ok: true,
      message: `Уровень фермы установлен: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/set-protection', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 120);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и level 0-120' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    db.prepare(`
      UPDATE farm_profiles
      SET protection_level = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, 'admin_set_protection', { level });

    res.json({
      ok: true,
      message: `Защита установлена: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/set-raid-power', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 200);

    if (!login || !Number.isFinite(level)) {
      return res.status(400).json({ ok: false, error: 'Нужен login и level 0-200' });
    }

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    db.prepare(`
      UPDATE farm_profiles
      SET raid_power = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(level, Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, 'admin_set_raid_power', { level });

    res.json({
      ok: true,
      message: `Рейд-сила установлена: ${level}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/reset-raid-cooldown', async (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

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

    logAdminEvent(db, profile.twitch_id, 'admin_reset_raid_cooldown', {});

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

  router.post('/delete-buildings', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    saveFarmBackup(profile, 'before_delete_buildings');
    const farm = profile.farm || {};
    farm.buildings = {};

    db.prepare(`
      UPDATE farm_profiles
      SET farm_json = ?, updated_at = ?
      WHERE twitch_id = ?
    `).run(JSON.stringify(farm), Date.now(), profile.twitch_id);

    logAdminEvent(db, profile.twitch_id, 'admin_delete_buildings', {});

    res.json({
      ok: true,
      message: `Постройки удалены у ${login}`,
      profile: getProfileByLogin(db, login)
    });
  });

  router.post('/delete-farm', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');

    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

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

    logAdminEvent(db, profile.twitch_id, 'admin_delete_farm', {});

    res.json({
      ok: true,
      message: `Ферма ${login} сброшена`,
      profile: getProfileByLogin(db, login)
    });
  });
};
