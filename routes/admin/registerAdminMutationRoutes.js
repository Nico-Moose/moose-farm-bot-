module.exports = function registerAdminMutationRoutes(router, ctx) {

  router.post('/delete-farmer', async (req, res) => {
    try {
      const login = fmtAdminLogin(req.body?.login);
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник фермера' });

      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'Фермер не найден' });

      saveFarmBackup(profile, 'before_delete_farmer_hard');
      logAdminEvent(db, profile.twitch_id, 'admin_delete_farmer_hard', { login, mode: 'site_and_wizebot' });

      const deleteCommand = `!удалитьферму2 ${login}`;
      let wizebotTrigger = { ok: false, skipped: true, reason: 'say_to_channel_not_called' };

      try {
        wizebotTrigger = await sayToChannel(deleteCommand);
      } catch (triggerError) {
        wizebotTrigger = { ok: false, error: triggerError.message || String(triggerError) };
      }

      await sleep(900);
      db.prepare('DELETE FROM farm_profiles WHERE twitch_id = ?').run(profile.twitch_id);

      const warnings = [];
      if (!wizebotTrigger || !wizebotTrigger.ok) warnings.push('site_deleted_but_wizebot_not_confirmed');

      res.json({
        ok: true,
        login,
        deleted: true,
        wizebot_trigger: wizebotTrigger,
        warnings,
        message: warnings.length
          ? `Фермер ${login} удалён на сайте. Команда ${deleteCommand} отправлена без подтверждения — проверь Twitch chat / WizeBot.`
          : `Фермер ${login} удалён. Игроку нужно снова покупать ферму.`
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  const {
    db,
    getProfileByLogin,
    logAdminEvent,
    saveFarmBackup,
    deepCloneSafe,
    saveFarmObject,
    resetCaseCooldownOnly,
    resetRaidCooldownOnly,
    resetOffcollectCooldownOnly,
    resetGamusOnly,
    getAllProfiles,
    importLegacyFarmToSite,
    parseAmount,
    clampInt,
    syncProfileToWizebot,
    sayToChannel,
    sleep,
    fmtAdminLogin
  } = ctx;

  router.post('/player/set-building', (req, res) => {
    try {
      const login = fmtAdminLogin(req.body?.login);
      const building = String(req.body?.building || '').trim();
      const level = Math.max(0, Math.floor(Number(req.body?.level ?? 0)));
      if (!login || !building) return res.status(400).json({ ok: false, error: 'missing_login_or_building' });
      if (!Number.isFinite(level)) return res.status(400).json({ ok: false, error: 'invalid_level' });
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
      saveFarmBackup(profile, 'before_set_building_' + building);
      const farm = deepCloneSafe(profile.farm || {}, {});
      farm.buildings = farm.buildings || {};
      if (level <= 0) delete farm.buildings[building]; else farm.buildings[building] = level;
      saveFarmObject(profile.twitch_id, farm);
      logAdminEvent(db, profile.twitch_id, 'admin_set_building', { login, building, level });
      res.json({ ok: true, message: `Постройка ${building}: ур. ${level}`, profile: getProfileByLogin(db, login) });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post('/reset-case-cooldown', (req, res) => {
    const login = fmtAdminLogin(req.body?.login);
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    resetCaseCooldownOnly(profile);
    res.json({ ok: true, message: `КД кейса сброшен для ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/reset-offcollect-cooldown', (req, res) => {
    const login = fmtAdminLogin(req.body?.login);
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    resetOffcollectCooldownOnly(profile);
    res.json({ ok: true, message: `КД оффсбора сброшен для ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/reset-gamus-all', (req, res) => {
    let count = 0;
    for (const row of getAllProfiles()) {
      const profile = getProfileByLogin(db, row.login);
      if (profile) { resetGamusOnly(profile); count++; }
    }
    res.json({ ok: true, message: `GAMUS сброшен всем игрокам: ${count}` });
  });

  router.post('/reset-case-cooldown-all', (req, res) => {
    let count = 0;
    for (const row of getAllProfiles()) {
      const profile = getProfileByLogin(db, row.login);
      if (profile) { resetCaseCooldownOnly(profile); count++; }
    }
    res.json({ ok: true, message: `КД кейса сброшен всем игрокам: ${count}` });
  });

  router.post('/reset-raid-cooldown-all', (req, res) => {
    let count = 0;
    for (const row of getAllProfiles()) {
      const profile = getProfileByLogin(db, row.login);
      if (profile) { resetRaidCooldownOnly(profile); count++; }
    }
    res.json({ ok: true, message: `КД рейда сброшен всем игрокам: ${count}` });
  });

  router.post('/reset-offcollect-cooldown-all', (req, res) => {
    let count = 0;
    for (const row of getAllProfiles()) {
      const profile = getProfileByLogin(db, row.login);
      if (profile) { resetOffcollectCooldownOnly(profile); count++; }
    }
    res.json({ ok: true, message: `КД оффсбора сброшен всем игрокам: ${count}` });
  });

  router.post('/give-farm-balance', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);
    if (!login || !Number.isFinite(amount)) return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const next = profile.farm_balance + amount;
    db.prepare(`UPDATE farm_profiles SET farm_balance = ?, updated_at = ? WHERE twitch_id = ?`).run(next, Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_farm_balance', { amount, next });
    res.json({ ok: true, message: `Фермерский баланс изменён на ${amount}. Теперь: ${next}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/give-upgrade-balance', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);
    if (!login || !Number.isFinite(amount)) return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const next = profile.upgrade_balance + amount;
    db.prepare(`UPDATE farm_profiles SET upgrade_balance = ?, updated_at = ? WHERE twitch_id = ?`).run(next, Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_upgrade_balance', { amount, next });
    res.json({ ok: true, message: `Бонусный баланс изменён на ${amount}. Теперь: ${next}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/give-parts', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const amount = parseAmount(req.body.amount);
    if (!login || !Number.isFinite(amount)) return res.status(400).json({ ok: false, error: 'Нужен login и amount' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const next = Math.max(0, Number(profile.parts || 0) + amount);
    const farm = deepCloneSafe(profile.farm || {}, {});
    farm.resources = farm.resources || {};
    farm.resources.parts = next;
    db.prepare(`UPDATE farm_profiles SET parts = ?, farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(next, JSON.stringify(farm), Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_parts', { amount, next });
    res.json({ ok: true, message: `Запчасти изменены на ${amount}. Теперь: ${next}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/set-level', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 999);
    if (!login || !Number.isFinite(level)) return res.status(400).json({ ok: false, error: 'Нужен login и level 0-999' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    const farm = deepCloneSafe(profile.farm || {}, {});
    farm.level = level;
    db.prepare(`UPDATE farm_profiles SET level = ?, farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(level, JSON.stringify(farm), Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_set_level', { level });
    res.json({ ok: true, message: `Уровень фермы установлен: ${level}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/set-protection', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 120);
    if (!login || !Number.isFinite(level)) return res.status(400).json({ ok: false, error: 'Нужен login и level 0-120' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    db.prepare(`UPDATE farm_profiles SET protection_level = ?, updated_at = ? WHERE twitch_id = ?`).run(level, Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_set_protection', { level });
    res.json({ ok: true, message: `Защита установлена: ${level}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/set-raid-power', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const level = clampInt(req.body.level, 0, 200);
    if (!login || !Number.isFinite(level)) return res.status(400).json({ ok: false, error: 'Нужен login и level 0-200' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    db.prepare(`UPDATE farm_profiles SET raid_power = ?, updated_at = ? WHERE twitch_id = ?`).run(level, Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_set_raid_power', { level });
    res.json({ ok: true, message: `Рейд-сила установлена: ${level}`, profile: getProfileByLogin(db, login) });
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
    db.prepare(`UPDATE farm_profiles SET farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(JSON.stringify(farm), Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_reset_raid_cooldown', {});
    try { await syncProfileToWizebot(getProfileByLogin(db, login)); } catch (error) { console.error('[ADMIN RESET RAID COOLDOWN PUSH] Error:', error); }
    res.json({ ok: true, message: `КД рейда сброшен для ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/delete-buildings', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });
    saveFarmBackup(profile, 'before_delete_buildings');
    const farm = profile.farm || {};
    farm.buildings = {};
    db.prepare(`UPDATE farm_profiles SET farm_json = ?, updated_at = ? WHERE twitch_id = ?`).run(JSON.stringify(farm), Date.now(), profile.twitch_id);
    logAdminEvent(db, profile.twitch_id, 'admin_delete_buildings', {});
    res.json({ ok: true, message: `Постройки удалены у ${login}`, profile: getProfileByLogin(db, login) });
  });

  router.post('/delete-farm', async (req, res) => {
    try {
      const login = fmtAdminLogin(req.body?.login);
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник фермера' });
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'Фермер не найден' });
      saveFarmBackup(profile, 'before_delete_farm_hard');
      logAdminEvent(db, profile.twitch_id, 'admin_delete_farm_hard', { login, mode: 'site_and_wizebot', route: 'delete-farm' });
      const deleteCommand = `!удалитьферму2 ${login}`;
      let wizebotTrigger = { ok: false, skipped: true, reason: 'say_to_channel_not_called' };
      try { wizebotTrigger = await sayToChannel(deleteCommand); } catch (triggerError) { wizebotTrigger = { ok: false, error: triggerError.message || String(triggerError) }; }
      await sleep(900);
      db.prepare('DELETE FROM farm_profiles WHERE twitch_id = ?').run(profile.twitch_id);
      const warnings = [];
      if (!wizebotTrigger || !wizebotTrigger.ok) warnings.push('site_deleted_but_wizebot_not_confirmed');
      res.json({ ok: true, login, deleted: true, wizebot_trigger: wizebotTrigger, warnings, message: warnings.length ? `Фермер ${login} удалён на сайте. Команда ${deleteCommand} отправлена без подтверждения — проверь Twitch chat / WizeBot.` : `Фермер ${login} удалён. Игроку нужно снова покупать ферму.` });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });
};
