module.exports = function registerAdminFieldAndLookupRoutes(router, ctx) {
  const {
    db,
    getProfileByLogin,
    getAllProfiles,
    saveFarmBackup,
    deepCloneSafe,
    logAdminEvent,
    getProfileById,
    sayToChannel,
    sleep,
    fmtAdminLogin,
    loadPlayerLogins,
    loadFarmers,
    normalizePlayerProfile
  } = ctx;

  router.post('/player/set-field', (req, res) => {
    try {
      const login = fmtAdminLogin(req.body?.login);
      const field = String(req.body?.field || '').trim();
      const value = Number(req.body?.value ?? 0);

      if (!login || !field) return res.status(400).json({ ok: false, error: 'missing_login_or_field' });
      if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'invalid_number' });

      const allowed = new Set([
        'level','farm_balance','upgrade_balance','parts','license_level','raid_power','protection_level',
        'turret_level','turret_chance','total_income'
      ]);
      if (!allowed.has(field)) return res.status(400).json({ ok: false, error: 'field_not_allowed' });

      const profile = getProfileByLogin(db, login);
      if (!profile) return res.status(404).json({ ok: false, error: 'profile_not_found' });

      saveFarmBackup(profile, 'before_set_field_' + field);

      const farm = deepCloneSafe(profile.farm || {}, {});
      farm.resources = farm.resources || {};
      farm.buildings = farm.buildings || {};
      const turret = deepCloneSafe(profile.turret || {}, {});
      const now = Date.now();

      if (field === 'level') {
        const nextLevel = Math.max(0, Math.floor(value));
        farm.level = nextLevel;
        db.prepare(`UPDATE farm_profiles SET level=?, farm_json=?, updated_at=? WHERE twitch_id=?`)
          .run(nextLevel, JSON.stringify(farm), now, profile.twitch_id);
      } else if (field === 'farm_balance') {
        db.prepare(`UPDATE farm_profiles SET farm_balance=?, updated_at=? WHERE twitch_id=?`)
          .run(value, now, profile.twitch_id);
      } else if (field === 'upgrade_balance') {
        db.prepare(`UPDATE farm_profiles SET upgrade_balance=?, updated_at=? WHERE twitch_id=?`)
          .run(value, now, profile.twitch_id);
      } else if (field === 'total_income') {
        db.prepare(`UPDATE farm_profiles SET total_income=?, updated_at=? WHERE twitch_id=?`)
          .run(value, now, profile.twitch_id);
      } else if (field === 'parts') {
        farm.resources.parts = value;
        db.prepare(`UPDATE farm_profiles SET parts=?, farm_json=?, updated_at=? WHERE twitch_id=?`)
          .run(value, JSON.stringify(farm), now, profile.twitch_id);
      } else if (field === 'license_level') {
        db.prepare(`UPDATE farm_profiles SET license_level=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'raid_power') {
        db.prepare(`UPDATE farm_profiles SET raid_power=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'protection_level') {
        db.prepare(`UPDATE farm_profiles SET protection_level=?, updated_at=? WHERE twitch_id=?`)
          .run(Math.max(0, Math.floor(value)), now, profile.twitch_id);
      } else if (field === 'turret_level') {
        turret.level = Math.max(0, Math.floor(value));
        db.prepare(`UPDATE farm_profiles SET turret_json=?, updated_at=? WHERE twitch_id=?`)
          .run(JSON.stringify(turret), now, profile.twitch_id);
      } else if (field === 'turret_chance') {
        turret.chance = Number(value || 0);
        db.prepare(`UPDATE farm_profiles SET turret_json=?, updated_at=? WHERE twitch_id=?`)
          .run(JSON.stringify(turret), now, profile.twitch_id);
      }

      logAdminEvent(db, profile.twitch_id, 'admin_set_field', { login, field, value });
      return res.json({ ok: true, profile: getProfileByLogin(db, login) });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.get('/players', (req, res) => {
    res.json({ ok: true, players: loadPlayerLogins(req.query.prefix || '') });
  });

  router.get('/farmers', (req, res) => {
    try {
      const result = loadFarmers(req.query);
      res.json({ ok: true, total: result.total, farmers: result.farmers });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || String(error) });
    }
  });

  router.get('/player/:nick', (req, res) => {
    const profile = getProfileByLogin(db, req.params.nick);
    if (!profile) {
      return res.status(404).json({
        ok: false,
        error: 'Игрок не найден. Он должен хотя бы раз войти на сайт через Twitch.'
      });
    }
    res.json({ ok: true, profile: normalizePlayerProfile ? normalizePlayerProfile(profile) : profile });
  });
};
