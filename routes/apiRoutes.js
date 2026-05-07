const express = require('express');
const { getDb } = require('../services/dbService');

const {
  getProfile,
  updateProfile,
  markWizebotSyncAt,
  logFarmEvent,
  listProfiles,
  listRaidCandidateProfiles,
  listTopProfilesLite,
  listFarmEvents,
  touchPresence,
  listOnlineFarmers,
  listFarmerDirectory,
  getProfileByLogin,
  getPresenceHideSetting,
  setPresenceHideSetting
} = require('../services/userService');

const {
  getNextUpgrade,
  upgradeFarm
} = require('../services/farm/upgradeService');

const {
  collectFarm
} = require('../services/farm/collectService');

const {
  addTestBalance
} = require('../services/farmGameService');

const {
  buyBuilding,
  upgradeBuilding,
  listBuildings
} = require('../services/farm/buildingService');

const {
  getMarketState,
  buyParts,
  sellParts
} = require('../services/farm/marketService');

const {
  getNextLicense,
  buyNextLicense
} = require('../services/farm/licenseService');

const {
  getStatus: getRaidUpgradeStatus,
  upgradeRaidPower,
  upgradeProtection
} = require('../services/farm/raidUpgradeService');

const {
  getTurretState,
  upgradeTurret
} = require('../services/farm/turretService');

const {
  getRaidStatus,
  performRaid
} = require('../services/farm/raidService');

const {
  syncWizebotFarmToProfile
} = require('../services/wizebotSyncService');

const {
  getCaseStatus,
  openCase
} = require('../services/farm/caseService');

const {
  getGamusStatus,
  claimGamus
} = require('../services/farm/gamusService');

const {
  offCollect
} = require('../services/farm/offCollectService');

const {
  getFarmInfo,
  getRaidInfo,
  getTopRaids,
  getTopProfiles
} = require('../services/farm/infoService');

const {
  buildLootSnapshotForTwitchId,
  redeemPromoForUser,
  openLootCaseForUser,
  takeLootForUser,
  takeLootSelectionForUser,
  parseTakeRequest
} = require('../services/lootService');

const router = express.Router();

// Важно для живого UI: API-ответы не должны кешироваться браузером/прокси,
// иначе после успешных апгрейдов пользователь видит старые данные до F5.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

const { config } = require('../config');
const { syncProfileToWizebotIfNeeded, isWebMasterProfile } = require('../services/wizebotApiService');
const { enqueueProfileSync, getQueueStats } = require('../services/wizebotSyncQueueService');
const { getStreamStatus, getActualTwitchStreamStatus, getStreamStatusSnapshot } = require('../services/streamStatusService');
const { getCache, setCache, invalidateFarmCache } = require('../services/apiCacheService');

function hasActiveFarm(profile) {
  return !!(
    profile &&
    profile.farm &&
    typeof profile.farm === 'object' &&
    Object.keys(profile.farm).length > 0
  );
}

function emptyFarmProfile(req) {
  const user = req?.session?.twitchUser || {};
  return {
    twitch_id: user.id || null,
    login: user.login || '',
    display_name: user.display_name || user.login || '',
    avatar_url: user.avatarUrl || '',
    level: 0,
    farm_balance: 0,
    twitch_balance: 0,
    upgrade_balance: 0,
    total_income: 0,
    parts: 0,
    last_collect_at: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    farm: null,
    configs: {},
    license_level: 0,
    protection_level: 0,
    raid_power: 0,
    turret: {},
    last_wizebot_sync_at: null
  };
}

function requireAuth(req, res, next) {
  if (!req.session.twitchUser) {
    return res.status(401).json({ ok: false, error: 'not_logged_in' });
  }

  next();
}


const pendingFarmActions = new Set();

function farmActionGuard(req, res, next) {
  if (req.method !== 'POST') return next();

  const userId = req.session?.twitchUser?.id || 'anonymous';
  const key = `${userId}:farm`; // один замок на все farm POST-действия: защита от двойных кликов между разными кнопками

  if (pendingFarmActions.has(key)) {
    return res.status(409).json({
      ok: false,
      error: 'action_in_progress',
      message: 'Действие уже выполняется. Подожди завершения предыдущего клика.'
    });
  }

  const allowWithoutFarm = req.path === '/sync-wizebot';
  const profile = getProfile(userId);
  req.farmProfile = profile;

  if (!allowWithoutFarm && !hasActiveFarm(profile)) {
    return res.status(400).json({
      ok: false,
      error: 'farm_not_found',
      message: 'Ферма не активна. Купи ферму заново.',
      ...profilePayload(profile)
    });
  }

  pendingFarmActions.add(key);
  res.on('finish', () => pendingFarmActions.delete(key));
  res.on('close', () => pendingFarmActions.delete(key));
  next();
}


function runImmediateDbTransaction(work) {
  const db = getDb();
  db.prepare('BEGIN IMMEDIATE').run();
  try {
    const result = work();
    db.prepare('COMMIT').run();
    return result;
  } catch (error) {
    try { db.prepare('ROLLBACK').run(); } catch (_) {}
    throw error;
  }
}


async function pushProfileToWizebotForTest(req, profile) {
  try {
    const result = await syncProfileToWizebotIfNeeded(profile);

    if (result.ok || (Array.isArray(result.keys) && result.keys.length > 0)) {
      const refreshed = markWizebotSyncAt(profile.twitch_id, result.syncedAt);
      logFarmEvent(req.session.twitchUser.id, 'sync_wizebot_push', {
        login: profile.login,
        ok: result.ok,
        keys: result.keys,
        skippedKeys: result.skippedKeys || [],
        failedKeys: result.failedKeys || [],
        syncedAt: result.syncedAt
      });
      return {
        profile: refreshed,
        wizebotSync: result
      };
    }

    return {
      profile,
      wizebotSync: result
    };
  } catch (error) {
    console.error('[WIZEBOT PUSH] Error:', error);
    logFarmEvent(req.session.twitchUser.id, 'sync_wizebot_push_failed', {
      login: profile?.login,
      message: error.message,
      details: error.details || null
    });
    return {
      profile,
      wizebotSync: {
        ok: false,
        error: 'wizebot_push_failed',
        message: error.message
      }
    };
  }
}

function profilePayload(profile) {
  const activeFarm = hasActiveFarm(profile);

  if (!activeFarm) {
    const safeProfile = profile && typeof profile === 'object' ? profile : emptyFarmProfile();
    const streamStatus = getStreamStatusSnapshot();
    return {
      profile: safeProfile,
      hasFarm: false,
      farmActive: false,
      nextUpgrade: null,
      nextLicense: null,
      market: { listings: [], history: [], globals: {} },
      raidUpgrades: { raidPower: 0, protectionLevel: 0, nextRaidPowerCost: 0, nextProtectionCost: 0 },
      turret: { level: 0, chance: 0, nextCost: 0, nextChance: 0 },
      raid: { unlocked: false, remainingMs: 0, cooldownMs: 0 },
      caseStatus: { cooldownMs: 0, ready: false },
      gamus: { ready: false, cooldownMs: 0 },
      farmInfo: { hourly: { total: 0, parts: 0, bonus: 0 } },
      raidInfo: { items: [] },
      streamStatus,
      streamOnline: !!streamStatus.online,
      harvestManagedByWizebot: !!config.harvestManagedByWizebot
    };
  }

  return {
    profile,
    hasFarm: true,
    farmActive: true,
    nextUpgrade: getNextUpgrade(profile),
    nextLicense: getNextLicense(profile),
    market: getMarketState(profile),
    raidUpgrades: getRaidUpgradeStatus(profile),
    turret: getTurretState(profile),
    raid: getRaidStatus(profile),
    caseStatus: getCaseStatus(profile),
    gamus: getGamusStatus(profile),
    farmInfo: getFarmInfo(profile),
    raidInfo: getRaidInfo(profile),
    streamStatus: getStreamStatusSnapshot(),
    streamOnline: !!getStreamStatusSnapshot().online,
    harvestManagedByWizebot: !!config.harvestManagedByWizebot
  };
}


function isFreshEnoughForWrite(req, profile) {
  const expectedUpdatedAt = Number(req.body?.expectedUpdatedAt || 0);
  if (!expectedUpdatedAt) return { ok: true };

  const actualUpdatedAt = Number(profile?.updated_at || 0);
  if (!actualUpdatedAt || actualUpdatedAt === expectedUpdatedAt) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 409,
    error: 'stale_profile',
    message: 'Профиль уже изменился. Обновили данные перед следующим действием.',
    expectedUpdatedAt,
    actualUpdatedAt
  };
}

function fastSyncMeta(profile, req, source) {
  const queued = enqueueProfileSync(profile, {
    source,
    twitchUserId: req.session?.twitchUser?.id || profile?.twitch_id
  });
  return {
    mode: 'async_queue',
    queued: !!queued?.queued,
    queue: getQueueStats(profile?.login),
    requestedAt: queued?.requestedAt || Date.now()
  };
}

async function requireStreamOnlineForAction(profile, actionName) {
  const streamStatus = await getStreamStatus();
  if (streamStatus.online) return { ok: true, streamStatus };
  return {
    ok: false,
    error: 'stream_offline',
    message: `${actionName} доступен только во время онлайн-стрима.`,
    streamStatus
  };
}

async function requireStreamOfflineForAction(profile, actionName) {
  const streamStatus = await getStreamStatus();
  if (!streamStatus.online) return { ok: true, streamStatus };
  return {
    ok: false,
    error: 'stream_online',
    message: `${actionName} доступен только когда стрим оффлайн.`,
    streamStatus
  };
}

function conflictResponse(req, res, stale, profile) {
  return res.status(stale.status || 409).json({
    ok: false,
    ...stale,
    ...profilePayload(profile)
  });
}

router.use('/farm', requireAuth, farmActionGuard);

router.use('/farm', (req, res, next) => {
  if (req.method === 'POST') {
    const twitchId = req.session?.twitchUser?.id;
    res.on('finish', () => {
      if (res.statusCode < 500) invalidateFarmCache(twitchId);
    });
  }
  next();
});

router.get('/me', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const streamStatus = await getStreamStatus();
  const cacheKey = `farm:${req.session.twitchUser.id}:me:${profile?.updated_at || 0}:${profile?.last_wizebot_sync_at || 0}:${streamStatus?.online ? 1 : 0}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const payload = {
    ok: true,
    user: req.session.twitchUser,
    ...profilePayload(profile),
    streamStatus,
    streamOnline: !!streamStatus.online
  };

  res.json(setCache(cacheKey, payload, 1200));
});

router.get('/stream/status', requireAuth, async (req, res) => {
  const streamStatus = await getStreamStatus();
  res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online });
});

router.get('/stream/embed-status', requireAuth, async (req, res) => {
  const streamStatus = await getActualTwitchStreamStatus();
  res.json({ ok: true, streamStatus, streamOnline: !!streamStatus.online });
});


router.get('/loot/me', requireAuth, (req, res) => {
  try {
    const loot = buildLootSnapshotForTwitchId(req.session.twitchUser.id);
    res.json({ ok: true, loot });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/loot/promo', requireAuth, (req, res) => {
  try {
    const result = redeemPromoForUser(req.session.twitchUser, req.body?.code);
    if (!result.ok) return res.status(400).json(result);
    res.json({ ok: true, ...result, loot: buildLootSnapshotForTwitchId(req.session.twitchUser.id) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/loot/open', requireAuth, async (req, res) => {
  try {
    const result = await openLootCaseForUser(req.session.twitchUser, req.body?.amount);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/loot/take', requireAuth, async (req, res) => {
  try {
    const request = req.body?.request && typeof req.body.request === 'object'
      ? req.body.request
      : parseTakeRequest(String(req.body?.query || req.body?.request || '').trim());
    const result = await takeLootForUser(req.session.twitchUser, request);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/loot/take-selection', requireAuth, async (req, res) => {
  try {
    const result = await takeLootSelectionForUser(req.session.twitchUser, req.body?.selections);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/farm/presence', requireAuth, (req, res) => {
  try {
    touchPresence(req.session.twitchUser.id, req.body?.page || 'farm');
    res.json({ ok: true, seenAt: Date.now() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get('/farm/online-farmers', requireAuth, (req, res) => {
  try {
    const players = listOnlineFarmers({ withinMs: 3 * 60 * 1000, limit: 50 }).map((profile) => ({
      login: profile.login,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      level: profile.level,
      last_seen_at: profile.last_seen_at,
      page: profile.page || 'farm'
    }));
    res.json({ ok: true, players, total: players.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});


router.get('/farm/presence-visibility', requireAuth, (req, res) => {
  try {
    const login = String(req.session?.twitchUser?.login || req.session?.twitchUser?.display_name || '').trim().toLowerCase().replace(/^@/, '');
    if (login !== 'nico_moose') return res.json({ ok: true, can_toggle: false, hidden: false });
    return res.json({ ok: true, can_toggle: true, hidden: getPresenceHideSetting(login) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/farm/presence-visibility', requireAuth, (req, res) => {
  try {
    const login = String(req.session?.twitchUser?.login || req.session?.twitchUser?.display_name || '').trim().toLowerCase().replace(/^@/, '');
    if (login !== 'nico_moose') return res.status(403).json({ ok: false, error: 'forbidden' });
    const hidden = !!req.body?.hidden;
    setPresenceHideSetting(login, hidden);
    res.json({ ok: true, can_toggle: true, hidden });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get('/farm/farmers-directory', requireAuth, (req, res) => {
  try {
    const search = String(req.query.q || '');
    const players = listFarmerDirectory({ search, limit: 500 }).map((profile) => ({
      login: profile.login,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      level: profile.level,
      is_online: !!profile.is_online,
      last_seen_at: profile.last_seen_at || 0
    }));
    res.json({ ok: true, players, total: players.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.get('/farm/farmer-profile/:login', requireAuth, (req, res) => {
  try {
    const login = String(req.params.login || '').trim().toLowerCase().replace(/^@/, '');
    const profile = getProfileByLogin(login);
    if (!profile || !hasActiveFarm(profile)) {
      return res.status(404).json({ ok: false, error: 'farmer_not_found' });
    }

    const farm = profile.farm || {};
    const buildings = farm.buildings || {};
    res.json({
      ok: true,
      profile: {
        login: profile.login,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        level: profile.level,
        twitch_balance: profile.twitch_balance,
        farm_balance: profile.farm_balance,
        upgrade_balance: profile.upgrade_balance,
        parts: profile.parts,
        license_level: profile.license_level,
        protection_level: profile.protection_level,
        raid_power: profile.raid_power,
        turret: profile.turret || {},
        buildings,
        updated_at: profile.updated_at || 0,
        last_wizebot_sync_at: profile.last_wizebot_sync_at || 0
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || String(error) });
  }
});

router.post('/farm/collect', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);

  if (config.harvestManagedByWizebot) {
    return res.json({
      ok: false,
      error: 'harvest_managed_by_wizebot',
      message: 'Сбор урожая теперь выполняется автоматически командой !урожай в WizeBot и подтягивается на сайт.',
      ...profilePayload(profile)
    });
  }

  const result = collectFarm(profile);

  if (!result.ok) {
    return res.json({
      ...result,
      buildings: result.buildings || [],
      ...profilePayload(profile)
    });
  }

  let updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'collect', {
    income: result.income,
    partsIncome: result.partsIncome,
    minutes: result.minutes
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'building_buy');

  res.json({
    ok: true,
    wizebotSync,
    income: result.income,
    partsIncome: result.partsIncome,
    minutes: result.minutes,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/upgrade', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const count = req.body.count || 1;
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);

  const result = upgradeFarm(profile, count);
  let updatedProfile = updateProfile(result.profile);

  if (result.upgraded > 0) {
    logFarmEvent(req.session.twitchUser.id, 'upgrade', {
      requested: count,
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'farm_upgrade');

  res.json({
    ok: result.ok,
    wizebotSync,
    upgraded: result.upgraded,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    stopReason: result.stopReason,
    requiredLicense: result.requiredLicense,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/test-balance', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = addTestBalance(profile, 100000);
  let updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'test_balance', {
    amount: result.amount
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'building_buy');

  res.json({
    ok: true,
    wizebotSync,
    amount: result.amount,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/building/buy', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);

  const result = buyBuilding(profile, key);

  if (!result.ok) {
    return res.json({
      ...result,
      buildings: listBuildings(profile),
      ...profilePayload(profile)
    });
  }

  let updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'building_buy', {
    building: result.building,
    totalCost: result.totalCost,
    totalParts: result.totalParts
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'building_buy');

  res.json({
    ok: true,
    wizebotSync,
    building: result.building,
    name: result.name,
    level: result.level,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    buildings: result.buildings,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/building/upgrade', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;
  const count = req.body.count || 1;
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);

  const result = upgradeBuilding(profile, key, count);
  let updatedProfile = result.profile ? updateProfile(result.profile) : profile;

  if (result.upgraded > 0) {
    logFarmEvent(req.session.twitchUser.id, 'building_upgrade', {
      building: result.building,
      requested: count,
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'building_upgrade');

  res.json({
    ok: result.ok,
    wizebotSync,
    building: result.building,
    name: result.name,
    upgraded: result.upgraded,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    stopReason: result.stopReason,
    error: result.error,
    buildings: result.buildings,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/market/buy', requireAuth, async (req, res) => {
  const { result, updatedProfile } = runImmediateDbTransaction(() => {
    const profile = getProfile(req.session.twitchUser.id);
    const result = buyParts(profile, req.body.qty);
    const updatedProfile = updateProfile(result.profile);

    if (result.ok) {
      logFarmEvent(req.session.twitchUser.id, 'market_buy_parts', {
        requested: result.requested,
        qty: result.qty,
        totalCost: result.totalCost,
        totalParts: result.totalParts,
        limited: result.limited
      });
    }

    return { result, updatedProfile };
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'market_buy_parts');

  res.json({
    ...result,
    wizebotSync,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    nextLicense: getNextLicense(updatedProfile),
    market: getMarketState(updatedProfile)
  });
});

router.post('/farm/market/sell', requireAuth, async (req, res) => {
  const { result, updatedProfile } = runImmediateDbTransaction(() => {
    const profile = getProfile(req.session.twitchUser.id);
    const result = sellParts(profile, req.body.qty);
    const updatedProfile = updateProfile(result.profile);

    if (result.ok) {
      logFarmEvent(req.session.twitchUser.id, 'market_sell_parts', {
        qty: result.qty,
        totalCost: result.totalCost,
        totalParts: result.totalParts
      });
    }

    return { result, updatedProfile };
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'market_sell_parts');

  res.json({
    ...result,
    wizebotSync,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    nextLicense: getNextLicense(updatedProfile),
    market: getMarketState(updatedProfile)
  });
});


router.post('/farm/raid-power/upgrade', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);
  const result = upgradeRaidPower(profile, req.body.count || 1);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'raid_power_upgrade', {
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      level: result.level
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'raid_power_upgrade');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/protection/upgrade', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);
  const result = upgradeProtection(profile, req.body.count || 1);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'protection_upgrade', {
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      level: result.level
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'protection_upgrade');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/turret/upgrade', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const stale = isFreshEnoughForWrite(req, profile);
  if (!stale.ok) return conflictResponse(req, res, stale, profile);
  const result = upgradeTurret(profile);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'turret_upgrade', {
      level: result.level,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'case_open');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/raid', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const streamGate = await requireStreamOnlineForAction(profile, 'Рейд');
  if (!streamGate.ok) {
    return res.json({
      ok: false,
      error: streamGate.error,
      message: streamGate.message,
      ...profilePayload(profile),
      streamStatus: streamGate.streamStatus,
      streamOnline: false
    });
  }

  const candidates = listRaidCandidateProfiles();
  const result = performRaid(profile, candidates);

  if (!result.ok) {
    let updatedProfile = updateProfile(result.attacker || profile);
    const syncResult = await pushProfileToWizebotForTest(req, updatedProfile);
    updatedProfile = syncResult.profile;
    return res.json({
      ...result,
      wizebotSync: syncResult.wizebotSync,
      ...profilePayload(updatedProfile)
    });
  }

  const saveRaidResult = getDb().transaction(() => {
    const updatedAttacker = updateProfile(result.attacker);
    updateProfile(result.target);
    logFarmEvent(req.session.twitchUser.id, 'raid', {
      ...(result.log || {}),
      eventTitle: (result.log && result.log.killed_by_turret) ? 'Рейд отбит турелью' : 'Рейд выполнен',
      attacker: result.log?.attacker || profile.login,
      target: result.log?.target,
      stolen: Number(result.log?.stolen || 0),
      bonus_stolen: Number(result.log?.bonus_stolen || 0),
      turret_refund: Number(result.log?.turret_refund || 0),
      blocked: Number(result.log?.blocked || 0),
      strength: Number(result.log?.strength || 0),
      punish_mult: Number(result.log?.punish_mult || 1)
    });
    return updatedAttacker;
  });

  let updatedAttacker = saveRaidResult();
  const syncResult = await pushProfileToWizebotForTest(req, updatedAttacker);
  updatedAttacker = syncResult.profile;

  res.json({
    ok: true,
    wizebotSync: syncResult.wizebotSync,
    log: result.log,
    ...profilePayload(updatedAttacker)
  });
});

router.post('/farm/case/open', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const streamGate = await requireStreamOnlineForAction(profile, 'Кейс');
  if (!streamGate.ok) {
    return res.json({
      ok: false,
      error: streamGate.error,
      message: streamGate.message,
      ...profilePayload(profile),
      streamStatus: streamGate.streamStatus,
      streamOnline: false
    });
  }

  const result = openCase(profile);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'case_open', {
      eventTitle: 'Кейс открыт',
      cost: result.cost,
      prizeType: result.prize?.type,
      prizeValue: result.prize?.value || result.prize?.finalValue || 0,
      multiplier: result.prize?.multiplier || 1,
      prize: result.prize
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'gamus_claim');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/gamus/claim', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = claimGamus(profile);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'gamus_claim', {
      eventTitle: 'GAMUS получен',
      money: result.money,
      parts: result.parts,
      baseMoney: result.baseMoney || 0,
      baseParts: result.baseParts || 0,
      mineBonusMoney: result.mineBonusMoney || 0,
      mineBonusParts: result.mineBonusParts || 0,
      tierLevel: result.tierLevel,
      mineLevel: result.mineLevel || result.effectiveMineLevel || 0
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'off_collect');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/off-collect', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const streamGate = await requireStreamOfflineForAction(profile, 'Оффсбор');
  if (!streamGate.ok) {
    return res.json({
      ok: false,
      error: streamGate.error,
      message: streamGate.message,
      ...profilePayload(profile),
      streamStatus: streamGate.streamStatus,
      streamOnline: true
    });
  }

  const result = offCollect(profile);
  let updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'off_collect', {
      eventTitle: 'Оффсбор получен',
      income: result.income,
      partsIncome: result.partsIncome,
      minutes: result.minutes,
      rule: '50% фермы + 50% запчастей завода'
    });
  }

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'turret_upgrade');

  res.json({
    ...result,
    wizebotSync,
    ...profilePayload(updatedProfile)
  });
});


router.get('/farm/history', requireAuth, (req, res) => {
  const twitchId = req.session.twitchUser.id;
  const type = String(req.query.type || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
  const days = Math.min(7, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
  const cacheKey = `farm:${twitchId}:history:${type || 'all'}:${limit}:${days}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const payload = {
    ok: true,
    events: listFarmEvents({
      twitchId,
      type,
      limit,
      days
    })
  };
  res.json(setCache(cacheKey, payload, 1200));
});

router.get('/farm/info', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const cacheKey = `farm:${req.session.twitchUser.id}:info:${profile?.updated_at || 0}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  res.json(setCache(cacheKey, { ok: true, info: getFarmInfo(profile), raidInfo: getRaidInfo(profile) }, 1500));
});

router.get('/farm/top', requireAuth, (req, res) => {
  const days = [1, 7, 14].includes(Number(req.query.days)) ? Number(req.query.days) : 14;
  const cacheKey = `farm:top:${days}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const profiles = listTopProfilesLite();
  res.json(setCache(cacheKey, {
    ok: true,
    days,
    raidTop: getTopRaids(profiles, days),
    playerTop: getTopProfiles(profiles)
  }, 5000));
});

router.post('/farm/license/buy', requireAuth, async (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = buyNextLicense(profile);

  if (!result.ok) {
    return res.json({
      ...result,
      ...profilePayload(profile)
    });
  }

  let updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'license_buy', {
    licenseLevel: result.licenseLevel,
    cost: result.cost,
    spent: result.spent
  });

  const wizebotSync = fastSyncMeta(updatedProfile, req, 'building_buy');

  res.json({
    ok: true,
    wizebotSync,
    licenseLevel: result.licenseLevel,
    cost: result.cost,
    spent: result.spent,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/sync-wizebot', requireAuth, async (req, res) => {
  try {
    const twitchUser = req.session.twitchUser;
    const profile = getProfile(twitchUser.id);

    const result = await syncWizebotFarmToProfile({
      login: twitchUser.login,
      profile
    });

    if (!result.ok) {
      return res.status(403).json(result);
    }

    const updatedProfile = updateProfile(result.profile);

    logFarmEvent(twitchUser.id, 'sync_wizebot_api', {
      imported: result.imported
    });

    res.json({
      ok: true,
      imported: result.imported,
      ...profilePayload(updatedProfile)
    });
  } catch (error) {
    console.error('[WIZEBOT SYNC] Error:', error);

    res.status(500).json({
      ok: false,
      error: 'wizebot_sync_failed',
      message: error.message
    });
  }
});

module.exports = router;
