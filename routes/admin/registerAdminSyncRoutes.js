module.exports = function registerAdminSyncRoutes(router, ctx) {
  const {
    getProfileByLogin,
    getProfileById,
    updateProfile,
    upsertTwitchUser,
    logAdminEvent,
    syncWizebotFarmToProfile,
    syncProfileToWizebot,
    saveFarmBackup
  } = ctx;

  async function importLegacyFarmToSite(login, source = 'admin_import_legacy_farm') {
    login = String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
    if (!login) return { ok: false, error: 'Укажи ник игрока' };

    let profile = getProfileByLogin(ctx.db, login);

    if (!profile) {
      upsertTwitchUser({
        id: `legacy:${login}`,
        login,
        display_name: login,
        profile_image_url: ''
      });
      profile = getProfileByLogin(ctx.db, login);
    }

    if (!profile) return { ok: false, error: 'Не удалось создать профиль игрока на сайте' };

    saveFarmBackup(profile, 'before_import_legacy_farm');

    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (!result.ok) return result;

    const updatedProfile = updateProfile({ ...profile, ...result.profile, twitch_id: profile.twitch_id });

    let pushBack = null;
    try {
      pushBack = await syncProfileToWizebot(updatedProfile);
    } catch (error) {
      pushBack = { ok: false, error: error.message || String(error) };
    }

    const freshProfile = getProfileById(profile.twitch_id);
    logAdminEvent(ctx.db, profile.twitch_id, source, {
      login,
      imported: result.imported || null,
      pushBack
    });

    return {
      ok: true,
      profile: freshProfile,
      imported: result.imported || null,
      pushBack
    };
  }

  async function syncPlayerFromWizebot(login, source = 'admin_sync_from_wizebot') {
    login = String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
    if (!login) return { ok: false, error: 'Укажи ник игрока' };

    let profile = getProfileByLogin(ctx.db, login);

    if (!profile) {
      upsertTwitchUser({
        id: `wizebot:${login}`,
        login,
        display_name: login,
        profile_image_url: ''
      });
      profile = getProfileByLogin(ctx.db, login);
    }

    if (!profile) return { ok: false, error: 'Не удалось создать профиль игрока на сайте' };

    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (!result.ok) return result;

    const updatedProfile = updateProfile({ ...profile, ...result.profile, twitch_id: profile.twitch_id });

    let pushBack = null;
    try {
      pushBack = await syncProfileToWizebot(updatedProfile);
    } catch (error) {
      pushBack = { ok: false, error: error.message || String(error) };
    }

    logAdminEvent(ctx.db, profile.twitch_id, source, { login, imported: result.imported || null, pushBack });
    return { ok: true, profile: getProfileById(profile.twitch_id), imported: result.imported || null, pushBack };
  }

  async function pushPlayerToWizebot(login, source = 'admin_push_to_wizebot') {
    const profile = getProfileByLogin(ctx.db, login);
    if (!profile) return { ok: false, error: 'Игрок не найден' };
    const result = await syncProfileToWizebot(profile);
    logAdminEvent(ctx.db, profile.twitch_id, source, { login, result });
    return { ok: true, profile: getProfileById(profile.twitch_id), result };
  }

  router.post('/import-legacy-farm', async (req, res) => {
    try {
      const login = String(req.body?.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
      if (!login) return res.status(400).json({ ok: false, error: 'Укажи ник игрока' });

      const data = await importLegacyFarmToSite(login, 'admin_import_legacy_farm');
      if (!data.ok) {
        return res.status(400).json({
          ok: false,
          error: data.error || 'Не удалось перенести старую ферму в farm_v2'
        });
      }

      return res.json({
        ok: true,
        message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`,
        profile: data.profile,
        imported: data.imported || null,
        pushBack: data.pushBack || null
      });
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

      return res.json({
        ok: true,
        message: `Старая !ферма ${login} перенесена на сайт и в farm_v2`,
        profile: data.profile,
        imported: data.imported || null
      });
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

      return res.json({
        ok: true,
        message: `Игрок ${login} отправлен в WizeBot`,
        profile: data.profile,
        result: data.result || null
      });
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

      return res.json({
        ok: true,
        message: `Урожай игрока ${login} подтянут из WizeBot`,
        profile: data.profile,
        imported: data.imported || null
      });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });
};
