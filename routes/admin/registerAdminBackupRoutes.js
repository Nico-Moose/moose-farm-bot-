module.exports = function registerAdminBackupRoutes(router, ctx) {
  const adminEventsCache = new Map();

  const {
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
  } = ctx;

  router.post('/transfer-farm', (req, res) => {
    const oldLogin = String(req.body.oldLogin || '').toLowerCase().replace(/^@/, '');
    const newLogin = String(req.body.newLogin || '').toLowerCase().replace(/^@/, '');
    if (!oldLogin || !newLogin || oldLogin === newLogin) return res.status(400).json({ ok: false, error: 'Нужен старый и новый ник' });
    const oldProfile = getProfileByLogin(db, oldLogin);
    let newProfile = getProfileByLogin(db, newLogin);
    if (!oldProfile) return res.status(404).json({ ok: false, error: 'Старая ферма не найдена' });
    if (!newProfile) {
      upsertTwitchUser({
        id: `transfer:${newLogin}`,
        login: newLogin,
        display_name: newLogin,
        profile_image_url: ''
      });
      newProfile = getProfileByLogin(db, newLogin);
    }
    if (!newProfile) return res.status(404).json({ ok: false, error: 'Не удалось создать нового игрока для переноса' });
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
      logAdminEvent(db, profile.twitch_id, 'admin_clear_debt', { login, debt });
      return res.json({ ok: true, message: debt < 0 ? `Долг списан: ${Math.abs(debt)}` : 'Долга нет', profile: getProfileByLogin(db, login) });
    }
    const rows = db.prepare(`SELECT twitch_id, farm_balance FROM farm_profiles WHERE farm_balance < 0`).all();
    let total = 0;
    for (const row of rows) {
      total += Math.abs(Number(row.farm_balance || 0));
      db.prepare(`UPDATE farm_profiles SET farm_balance=0, updated_at=? WHERE twitch_id=?`).run(Date.now(), row.twitch_id);
      logAdminEvent(db, row.twitch_id, 'admin_clear_debt', { login: null, debt: row.farm_balance });
    }
    res.json({ ok: true, message: `Списаны долги у ${rows.length} игроков. Всего: ${total}` });
  });

  router.post('/reset-gamus', (req, res) => {
    const login = String(req.body.login || '').toLowerCase().replace(/^@/, '');
    if (!login) return res.status(400).json({ ok: false, error: 'Нужен login' });
    const profile = getProfileByLogin(db, login);
    if (!profile) return res.status(404).json({ ok: false, error: 'Игрок не найден' });

    const farm = profile.farm || {};
    farm.lastGamusAt = 0;
    farm.gamus = farm.gamus || {};
    farm.gamus.lastClaimAt = 0;

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
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const cacheKey = [login, type, limit, days].join('|');
    const now = Date.now();
    const cached = adminEventsCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return res.json({ ok: true, events: cached.events });
    }

    const since = now - days * 24 * 60 * 60 * 1000;
    const params = [since];
    let where = 'e.created_at >= ?';
    if (login) {
      const profile = getProfileByLogin(db, login);
      if (!profile) return res.json({ ok: true, events: [] });
      where += ' AND e.twitch_id = ?';
      params.push(profile.twitch_id);
    }
    if (type) {
      where += ' AND e.type = ?';
      params.push(type);
    }
    params.push(limit);
    const events = db.prepare(`SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at FROM farm_events e LEFT JOIN twitch_users u ON u.twitch_id=e.twitch_id WHERE ${where} ORDER BY e.created_at DESC LIMIT ?`).all(...params).map((e) => ({ ...e, payload: safeJson(e.payload, {}) }));
    adminEventsCache.set(cacheKey, { events, expiresAt: now + 3000 });
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

  function safeJson(raw, fallback) {
    try {
      return JSON.parse(raw || '');
    } catch (_) {
      return fallback;
    }
  }
};
