const express = require('express');
const router = express.Router();

const { config } = require('../config');
const { getDb } = require('../db');
const { upsertTwitchUser, getProfileByLogin, updateProfile, logFarmEvent } = require('../services/userService');
const { getWizebotStateByLogin } = require('../services/wizebotStateExportService');
const { buildFarmV2FromProfile } = require('../services/farmV2Service');
const { importWizebotPayloadByLogin } = require('../services/wizebotBridgeImportService');

function getProvidedSecret(req) {
  return String(
    req.query.secret ||
    req.headers['x-bridge-secret'] ||
    req.body?.secret ||
    ''
  ).trim();
}

async function fetchLongtextJson(longtextUrl) {
  const url = String(longtextUrl || '').trim();

  if (!url || !/^https:\/\/strm\.lv\/t\/longtexts\//i.test(url)) {
    throw new Error('invalid_longtext_url');
  }

  const res = await fetch(url, {
    headers: {
      'Accept': 'text/plain,application/json,text/html,*/*',
      'User-Agent': 'moose-farm-site/longtext-fetch'
    }
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`longtext_fetch_failed_${res.status}`);
  }

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('empty_longtext_body');
  }

  const jsonMatch =
    trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) ||
    trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  let raw = jsonMatch ? jsonMatch[1] : trimmed;

  raw = raw
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    raw = raw.slice(start, end + 1);
  }

  return JSON.parse(raw);
}

function applyFarmV2Push(login, farmV2) {
  let profile = getProfileByLogin(login);

  if (!profile) {
    upsertTwitchUser({
      id: `legacy:${login}`,
      login,
      display_name: login,
      profile_image_url: ''
    });

    profile = getProfileByLogin(login);
  }

  if (!profile) {
    return {
      ok: false,
      status: 404,
      body: { ok: false, error: 'profile_not_found', login }
    };
  }

  const balances = farmV2.balances || {};
  const progression = farmV2.progression || {};
  const farm = farmV2.farm || {};
  const defense = farmV2.defense || {};

  const hasIncomingTwitchBalance = Object.prototype.hasOwnProperty.call(balances, 'twitch_balance');
  const twitchBalance = hasIncomingTwitchBalance
    ? Number(balances.twitch_balance || 0)
    : Number(profile.twitch_balance ?? profile.balance ?? 0);

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
    last_wizebot_sync_at: Date.now(),
    twitch_balance: twitchBalance,
    balance: twitchBalance
  };

  const updatedProfile = updateProfile(nextProfile);

  try {
    const db = getDb();
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

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      login,
      updated: true,
      twitch_balance: twitchBalance,
      farm_balance: Number(balances.farm_balance || 0),
      upgrade_balance: Number(balances.upgrade_balance || 0),
      parts: Number(((farm.resources || {}).parts) || 0)
    }
  };
}

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

router.get('/pull-sync', async (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
  const url = String(req.query.url || '').trim();

  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  if (!url) {
    return res.status(400).json({ ok: false, error: 'missing_url' });
  }

  try {
    const result = await importWizebotPayloadByLogin({ login, url });

    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error || 'import_failed' });
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

  try {
    const result = applyFarmV2Push(login, farmV2);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[FARM V2 PUSH] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'farm_v2_push_failed',
      message: error.message
    });
  }
});

router.get('/farm-v2-push-longtext', async (req, res) => {
  const providedSecret = getProvidedSecret(req);

  if (!providedSecret || providedSecret !== config.wizebot.bridgeSecret) {
    return res.status(403).json({ ok: false, error: 'invalid_bridge_secret' });
  }

  const login = String(req.query.login || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '');

  const longtextUrl = String(req.query.longtext || '').trim();

  if (!login) {
    return res.status(400).json({ ok: false, error: 'missing_login' });
  }

  if (!longtextUrl) {
    return res.status(400).json({ ok: false, error: 'missing_longtext' });
  }

  try {
    const farmV2 = await fetchLongtextJson(longtextUrl);

    if (!farmV2 || typeof farmV2 !== 'object') {
      return res.status(400).json({ ok: false, error: 'invalid_longtext_payload' });
    }

    const result = applyFarmV2Push(login, farmV2);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[FARM V2 PUSH LONGTEXT] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'farm_v2_push_longtext_failed',
      message: error.message
    });
  }
});

module.exports = router;
