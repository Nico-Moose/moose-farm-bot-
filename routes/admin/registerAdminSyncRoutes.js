module.exports = function registerAdminSyncRoutes(router, ctx) {
  const {
    db,
    getStreamStatus,
    setSetting,
    logAdminEvent,
    importLegacyFarmToSite,
    pushPlayerToWizebot,
    syncPlayerFromWizebot
  } = ctx;

  router.get('/stream-status', async (req, res) => {
    const streamStatus = await getStreamStatus();
    res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online });
  });

  router.post('/stream-status', async (req, res) => {
    const mode = String(req.body?.mode || 'auto').toLowerCase();
    const value = ['online', 'true', '1'].includes(mode) ? 'online' : (['offline', 'false', '0'].includes(mode) ? 'offline' : 'auto');
    setSetting('stream_online_manual', value);
    const streamStatus = await getStreamStatus();
    logAdminEvent(db, req.session?.twitchUser?.id || 'admin', 'admin_stream_status', { mode: value, online: streamStatus.online });
    res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online, message: `Статус стрима: ${value}` });
  });

  router.post('/import-legacy-farm', async (req, res) => {
    try {
      const login = String(req.body?.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник игрока' });
      const data = await importLegacyFarmToSite(login, 'admin_import_legacy_farm');
      if (!data.ok) {
        return res.status(400).json({ ok: false, error: data.error || 'Не удалось перенести старую ферму в farm_v2' });
      }
      return res.json({ ok: true, message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`, profile: data.profile, imported: data.imported || null, pushBack: data.pushBack || null });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post('/sync-from-wizebot', async (req, res) => {
    try {
      const login = String(req.body?.login || '').toLowerCase().replace(/^@/, '');
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник игрока' });
      const data = await importLegacyFarmToSite(login, 'admin_sync_from_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || 'Не удалось импортировать игрока из WizeBot' });
      return res.json({ ok: true, message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`, profile: data.profile, imported: data.imported || null });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post('/push-to-wizebot', async (req, res) => {
    try {
      const login = String(req.body?.login || '').toLowerCase().replace(/^@/, '');
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник игрока' });
      const data = await pushPlayerToWizebot(login, 'admin_push_to_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || 'Не удалось отправить игрока в WizeBot' });
      return res.json({ ok: true, message: `Игрок ${login} отправлен в WizeBot`, profile: data.profile, result: data.result || null });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.post('/sync-harvest-from-wizebot', async (req, res) => {
    try {
      const login = String(req.body?.login || '').toLowerCase().replace(/^@/, '');
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник игрока' });
      const data = await syncPlayerFromWizebot(login, 'admin_sync_harvest_from_wizebot');
      if (!data.ok) return res.status(400).json({ ok: false, error: data.error || 'Не удалось подтянуть урожай из WizeBot' });
      return res.json({ ok: true, message: `Урожай игрока ${login} подтянут из WizeBot`, profile: data.profile, imported: data.imported || null });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });
};
