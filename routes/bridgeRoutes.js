const express = require('express');
const { config } = require('../config');
const { getNextUpgrade, listBuildings } = require('../services/farmGameService');
const { importPayloadToSqlite } = require('../services/wizebotBridgeImportService');
const { getWizebotStateByLogin } = require('../services/wizebotStateExportService');

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

module.exports = router;
