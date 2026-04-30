const express = require('express');
const { config } = require('../config');
const {
  getProfileByLogin,
  updateProfile,
  logFarmEvent,
} = require('../services/userService');
const { getNextUpgrade } = require('../services/farmGameService');
const { applyWizeBotBridgePayload } = require('../services/wizebotBridgeService');

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

  const login = String(req.body.login || req.body.user || '').trim().toLowerCase();
  const profile = getProfileByLogin(login);

  if (!profile) {
    return res.status(404).json({
      ok: false,
      error: 'site_profile_not_found',
      message: 'Сначала войди на сайт через Twitch, чтобы создать профиль в SQLite.',
    });
  }

  const result = applyWizeBotBridgePayload(profile, req.body);

  if (!result.ok) {
    return res.status(403).json(result);
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(updatedProfile.twitch_id, 'sync_wizebot_bridge', {
    imported: result.imported,
  });

  res.json({
    ok: true,
    profile: updatedProfile,
    imported: result.imported,
    nextUpgrade: getNextUpgrade(updatedProfile),
  });
});

module.exports = router;
