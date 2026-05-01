const express = require('express');
const { config } = require('../config');
const { getNextUpgrade, listBuildings } = require('../services/farmGameService');
const { importPayloadToSqlite } = require('../services/wizebotBridgeImportService');
const { getWizebotStateByLogin } = require('../services/wizebotStateExportService');
const { getProfileByLogin, updateProfile, logFarmEvent } = require('../services/userService');
const { syncWizebotFarmToProfile } = require('../services/wizebotSyncService');

const router = express.Router();

function getProvidedSecret(req) {
  return req.get('x-wizebot-bridge-secret') || req.body.secret || req.query.secret;
}

router.post('/wizebot-sync', (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({
      ok: false,
      error: 'invalid_bridge_secret',
    });
  }

  const result = importPayloadToSqlite(req.body || {});

  if (!result.ok) {
    return res.status(400).json(result);
  }

  res.json({
    ok: true,
    profile: result.profile,
    imported: result.imported,
    nextUpgrade: result.nextUpgrade || getNextUpgrade(result.profile),
    buildings: result.buildings || listBuildings(result.profile),
  });
});


router.get('/web-master-state', (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  const state = getWizebotStateByLogin(login);
  if (!state) {
    return res.status(404).json({ ok: false, error: 'profile_not_found', login });
  }

  res.json({ ok: true, source: 'site_web_master', syncedAt: Date.now(), ...state });
});


router.get('/wizebot-pull-sync', async (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  try {
    const profile = getProfileByLogin(login);
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'profile_not_found', login });
    }

    const result = await syncWizebotFarmToProfile({ login, profile, allowAnyLogin: true });
    if (!result.ok) {
      return res.status(400).json(result);
    }

    const updatedProfile = updateProfile(result.profile);
    logFarmEvent(updatedProfile.twitch_id, 'sync_wizebot_harvest', {
      login,
      imported: result.imported || null,
      source: 'wizebot_harvest_command'
    });

    return res.json({ ok: true, login, imported: result.imported, profile: updatedProfile });
  } catch (error) {
    console.error('[WIZEBOT PULL SYNC] Error:', error);
    return res.status(500).json({ ok: false, error: 'wizebot_pull_sync_failed', message: error.message });
  }
});

module.exports = router;
