const express = require('express');
const { config } = require('../config');
const { getNextUpgrade, listBuildings } = require('../services/farmGameService');
const { importPayloadToSqlite, importWizebotPayloadByLogin } = require('../services/wizebotBridgeImportService');
const { getWizebotStateByLogin } = require('../services/wizebotStateExportService');
const { getProfileByLogin, updateProfile, logFarmEvent } = require('../services/userService');
const { syncWizebotFarmToProfile } = require('../services/wizebotSyncService');
const { buildFarmV2FromProfile } = require('../services/farmV2Service');

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


router.get('/farm-v2-state', (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  const profile = getProfileByLogin(login);
  if (!profile) {
    return res.status(404).json({ ok: false, error: 'profile_not_found', login });
  }

  const farmV2 = buildFarmV2FromProfile(profile);
  if (!farmV2 || !farmV2.progression || !farmV2.progression.level) {
    return res.status(400).json({ ok: false, error: 'invalid_farm_v2_state', login });
  }

  res.json({ ok: true, login, farm_v2: farmV2 });
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



router.get('/wizebot-sync-url', async (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  const url = String(req.query.url || '').trim();
  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }
  if (!url || !/^https:\/\/strm\.lv\/t\/longtexts\//i.test(url)) {
    return res.status(400).json({ ok: false, error: 'invalid_longtext_url' });
  }

  try {
    const result = await importWizebotPayloadByLogin({ login, url });
    if (!result.ok) {
      console.warn('[WIZEBOT SYNC URL] Rejected payload:', { login, url, error: result.error });
      return res.status(400).json(result);
    }
    return res.json({ ok: true, login, imported: result.imported, profile: result.profile });
  } catch (error) {
    console.error('[WIZEBOT SYNC URL] Error:', error);
    return res.status(500).json({ ok: false, error: 'wizebot_sync_url_failed', message: error.message });
  }
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
router.get('/farm-v2-push', (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '');

  const payloadRaw = String(req.query.payload || '').trim();

  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  if (!payloadRaw) {
    return res.status(400).json({ ok: false, error: 'missing_payload' });
  }

  let farmV2 = null;
  try {
    farmV2 = JSON.parse(payloadRaw);
  } catch (_) {
    return res.status(400).json({ ok: false, error: 'invalid_payload_json' });
  }

  if (!farmV2 || typeof farmV2 !== 'object') {
    return res.status(400).json({ ok: false, error: 'invalid_payload_object' });
  }

  const profile = getProfileByLogin(login);
  if (!profile) {
    return res.status(404).json({ ok: false, error: 'profile_not_found', login });
  }

  try {
    const db = getDb();

    const balances = farmV2.balances || {};
    const progression = farmV2.progression || {};
    const farm = farmV2.farm || {};
    const defense = farmV2.defense || {};

    const nextProfile = {
      ...profile,
      level: Number(progression.level || 0),
      farm_balance: Number(balances.farm_balance || 0),
      upgrade_balance: Number(balances.upgrade_balance || 0),
      total_income: Number(balances.total_income || 0),
      parts: Number(((farm.resources || {}).parts) || 0),
      last_collect_at: progression.last_collect_at ? Number(progression.last_collect_at) : null,
      license_level: Number(progression.license_level || 0),
      protection_level: Number(progression.protection_level || 0),
      raid_power: Number(progression.raid_power || 0),
      farm,
      turret: defense.turret || {},
      last_wizebot_sync_at: Date.now()
    };

    // Обновляем farm_profiles через существующий сервис
    const updatedProfile = updateProfile(nextProfile);

    // Если обычное золото хранится в twitch_users или users — пробуем обновить напрямую.
    // Если таблицы/колонки нет, просто молча пропустим.
    const twitchBalance = Number(balances.twitch_balance || 0);

    try {
      db.prepare(`
        UPDATE twitch_users
        SET balance = ?
        WHERE twitch_id = ?
      `).run(twitchBalance, profile.twitch_id);
    } catch (_) {}

    try {
      db.prepare(`
        UPDATE users
        SET balance = ?
        WHERE twitch_id = ?
      `).run(twitchBalance, profile.twitch_id);
    } catch (_) {}

    logFarmEvent(updatedProfile.twitch_id, 'farm_v2_push_from_wizebot', {
      login,
      source: 'wizebot_command',
      balances: {
        twitch_balance: twitchBalance,
        farm_balance: Number(balances.farm_balance || 0),
        upgrade_balance: Number(balances.upgrade_balance || 0),
        parts: Number(((farm.resources || {}).parts) || 0)
      }
    });

    return res.json({
      ok: true,
      login,
      updated: true,
      twitch_balance: twitchBalance,
      farm_balance: Number(balances.farm_balance || 0),
      upgrade_balance: Number(balances.upgrade_balance || 0),
      parts: Number(((farm.resources || {}).parts) || 0)
    });
  } catch (error) {
    console.error('[FARM V2 PUSH] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'farm_v2_push_failed',
      message: error.message
    });
  }
});
module.exports = router;
