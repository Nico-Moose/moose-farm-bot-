function sanitizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

module.exports = function registerAdminTransferRoutes(router, deps) {
  const {
    db,
    getProfileByLogin,
    upsertTwitchUser,
    saveFarmBackup,
    logAdminEvent,
  } = deps;

  const stmtTransferIntoTarget = db.prepare(`
    UPDATE farm_profiles
    SET level=?, farm_balance=?, upgrade_balance=?, total_income=?, parts=?, last_collect_at=?, farm_json=?, configs_json=?, license_level=?, protection_level=?, raid_power=?, turret_json=?, updated_at=?
    WHERE twitch_id=?
  `);

  const stmtResetSourceFarm = db.prepare(`
    UPDATE farm_profiles
    SET level=0, farm_balance=0, upgrade_balance=0, total_income=0, parts=0, last_collect_at=?, farm_json='{}', license_level=0, protection_level=0, raid_power=0, turret_json='{}', updated_at=?
    WHERE twitch_id=?
  `);

  router.post('/transfer-farm', (req, res) => {
    const oldLogin = sanitizeLogin(req.body.oldLogin || '');
    const newLogin = sanitizeLogin(req.body.newLogin || '');

    if (!oldLogin || !newLogin || oldLogin === newLogin) {
      return res.status(400).json({ ok: false, error: 'Нужен старый и новый ник' });
    }

    const oldProfile = getProfileByLogin(db, oldLogin);
    let newProfile = getProfileByLogin(db, newLogin);

    if (!oldProfile) {
      return res.status(404).json({ ok: false, error: 'Старая ферма не найдена' });
    }

    if (!newProfile) {
      upsertTwitchUser({
        id: `transfer:${newLogin}`,
        login: newLogin,
        display_name: newLogin,
        profile_image_url: ''
      });
      newProfile = getProfileByLogin(db, newLogin);
    }

    if (!newProfile) {
      return res.status(404).json({ ok: false, error: 'Не удалось создать нового игрока для переноса' });
    }

    saveFarmBackup(oldProfile, 'before_transfer_from');
    saveFarmBackup(newProfile, 'before_transfer_to');

    const farm = oldProfile.farm || {};
    farm.owner = newLogin;

    stmtTransferIntoTarget.run(
      oldProfile.level,
      oldProfile.farm_balance + newProfile.farm_balance,
      oldProfile.upgrade_balance + newProfile.upgrade_balance,
      oldProfile.total_income + newProfile.total_income,
      oldProfile.parts + newProfile.parts,
      oldProfile.last_collect_at || newProfile.last_collect_at || null,
      JSON.stringify(farm),
      JSON.stringify(oldProfile.configs || newProfile.configs || {}),
      Math.max(oldProfile.license_level || 0, newProfile.license_level || 0),
      Math.max(oldProfile.protection_level || 0, newProfile.protection_level || 0),
      Math.max(oldProfile.raid_power || 0, newProfile.raid_power || 0),
      JSON.stringify(oldProfile.turret || newProfile.turret || {}),
      Date.now(),
      newProfile.twitch_id
    );

    stmtResetSourceFarm.run(Date.now(), Date.now(), oldProfile.twitch_id);

    logAdminEvent(db, newProfile.twitch_id, 'admin_transfer_farm', { oldLogin, newLogin });

    return res.json({
      ok: true,
      message: `Ферма перенесена: ${oldLogin} -> ${newLogin}`,
      profile: getProfileByLogin(db, newLogin)
    });
  });
};
