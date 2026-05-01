const express = require('express');
const { getDb } = require('../services/dbService');

const {
  getProfile,
  updateProfile,
  logFarmEvent,
  listProfiles,
  listFarmEvents
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

const router = express.Router();

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
  const key = `${userId}:farm`;

  if (pendingFarmActions.has(key)) {
    return res.status(409).json({
      ok: false,
      error: 'action_in_progress',
      message: 'Действие уже выполняется. Подожди завершения предыдущего клика.'
    });
  }

  pendingFarmActions.add(key);
  res.on('finish', () => pendingFarmActions.delete(key));
  res.on('close', () => pendingFarmActions.delete(key));
  next();
}

function profilePayload(profile) {
  return {
    profile,
    nextUpgrade: getNextUpgrade(profile),
    nextLicense: getNextLicense(profile),
    market: getMarketState(profile),
    raidUpgrades: getRaidUpgradeStatus(profile),
    turret: getTurretState(profile),
    raid: getRaidStatus(profile),
    caseStatus: getCaseStatus(profile),
    gamus: getGamusStatus(profile),
    farmInfo: getFarmInfo(profile),
    raidInfo: getRaidInfo(profile)
  };
}

router.use('/farm', requireAuth, farmActionGuard);

router.get('/me', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);

  res.json({
    ok: true,
    user: req.session.twitchUser,
    ...profilePayload(profile)
  });
});

router.post('/farm/collect', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = collectFarm(profile);

  if (!result.ok) {
    return res.json({
      ...result,
      buildings: result.buildings || [],
      ...profilePayload(profile)
    });
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'collect', {
    income: result.income,
    partsIncome: result.partsIncome,
    minutes: result.minutes
  });

  res.json({
    ok: true,
    income: result.income,
    partsIncome: result.partsIncome,
    minutes: result.minutes,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const count = req.body.count || 1;

  const result = upgradeFarm(profile, count);
  const updatedProfile = updateProfile(result.profile);

  if (result.upgraded > 0) {
    logFarmEvent(req.session.twitchUser.id, 'upgrade', {
      requested: count,
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  res.json({
    ok: result.ok,
    upgraded: result.upgraded,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    stopReason: result.stopReason,
    requiredLicense: result.requiredLicense,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/test-balance', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = addTestBalance(profile, 100000);
  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'test_balance', {
    amount: result.amount
  });

  res.json({
    ok: true,
    amount: result.amount,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/building/buy', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;

  const result = buyBuilding(profile, key);

  if (!result.ok) {
    return res.json({
      ...result,
      buildings: listBuildings(profile),
      ...profilePayload(profile)
    });
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'building_buy', {
    building: result.building,
    totalCost: result.totalCost,
    totalParts: result.totalParts
  });

  res.json({
    ok: true,
    building: result.building,
    name: result.name,
    level: result.level,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    buildings: result.buildings,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/building/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;
  const count = req.body.count || 1;

  const result = upgradeBuilding(profile, key, count);
  const updatedProfile = result.profile ? updateProfile(result.profile) : profile;

  if (result.upgraded > 0) {
    logFarmEvent(req.session.twitchUser.id, 'building_upgrade', {
      building: result.building,
      requested: count,
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  res.json({
    ok: result.ok,
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

router.post('/farm/market/buy', requireAuth, (req, res) => {
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

  res.json({
    ...result,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    nextLicense: getNextLicense(updatedProfile),
    market: getMarketState(updatedProfile)
  });
});

router.post('/farm/market/sell', requireAuth, (req, res) => {
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

  res.json({
    ...result,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    nextLicense: getNextLicense(updatedProfile),
    market: getMarketState(updatedProfile)
  });
});


router.post('/farm/raid-power/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = upgradeRaidPower(profile, req.body.count || 1);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'raid_power_upgrade', {
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      level: result.level
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/protection/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = upgradeProtection(profile, req.body.count || 1);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'protection_upgrade', {
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      level: result.level
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/turret/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = upgradeTurret(profile);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'turret_upgrade', {
      level: result.level,
      totalCost: result.totalCost,
      totalParts: result.totalParts
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/raid', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const candidates = listProfiles();
  const result = performRaid(profile, candidates);

  if (!result.ok) {
    const updatedProfile = updateProfile(result.attacker || profile);
    return res.json({
      ...result,
      ...profilePayload(updatedProfile)
    });
  }

  const saveRaidResult = getDb().transaction(() => {
    const updatedAttacker = updateProfile(result.attacker);
    updateProfile(result.target);
    logFarmEvent(req.session.twitchUser.id, 'raid', result.log);
    return updatedAttacker;
  });

  const updatedAttacker = saveRaidResult();

  res.json({
    ok: true,
    log: result.log,
    ...profilePayload(updatedAttacker)
  });
});

router.post('/farm/case/open', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = openCase(profile);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'case_open', {
      cost: result.cost,
      prize: result.prize
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/gamus/claim', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = claimGamus(profile);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'gamus_claim', {
      money: result.money,
      parts: result.parts,
      tierLevel: result.tierLevel
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});

router.post('/farm/off-collect', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = offCollect(profile);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'off_collect', {
      income: result.income,
      partsIncome: result.partsIncome,
      minutes: result.minutes
    });
  }

  res.json({
    ...result,
    ...profilePayload(updatedProfile)
  });
});


router.get('/farm/history', requireAuth, (req, res) => {
  const type = String(req.query.type || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
  const events = listFarmEvents({
    twitchId: req.session.twitchUser.id,
    type,
    limit
  });
  res.json({ ok: true, events });
});

router.get('/farm/info', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  res.json({ ok: true, info: getFarmInfo(profile), raidInfo: getRaidInfo(profile) });
});

router.get('/farm/top', requireAuth, (req, res) => {
  const days = [1, 7, 14].includes(Number(req.query.days)) ? Number(req.query.days) : 14;
  const profiles = listProfiles();
  res.json({
    ok: true,
    days,
    raidTop: getTopRaids(profiles, days),
    playerTop: getTopProfiles(profiles)
  });
});

router.post('/farm/license/buy', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = buyNextLicense(profile);

  if (!result.ok) {
    return res.json({
      ...result,
      ...profilePayload(profile)
    });
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'license_buy', {
    licenseLevel: result.licenseLevel,
    cost: result.cost,
    spent: result.spent
  });

  res.json({
    ok: true,
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
