const express = require('express');

const {
  getProfile,
  updateProfile,
  logFarmEvent
} = require('../services/userService');

const {
  getNextUpgrade,
  upgradeFarm,
  collectFarm,
  addTestBalance,
  listBuildings,
  buyBuilding,
  upgradeBuilding
} = require('../services/farmGameService');

const {
  syncWizebotFarmToProfile
} = require('../services/wizebotSyncService');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.twitchUser) {
    return res.status(401).json({ ok: false, error: 'not_logged_in' });
  }

  next();
}

function getUserProfile(req) {
  return getProfile(req.session.twitchUser.id);
}

function buildState(req, profile) {
  return {
    ok: true,
    user: req.session.twitchUser,
    profile,
    nextUpgrade: getNextUpgrade(profile),
    buildings: listBuildings(profile)
  };
}

router.get('/me', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  res.json(buildState(req, profile));
});

router.post('/farm/collect', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  const result = collectFarm(profile);

  if (!result.ok) {
    return res.json({
      ...result,
      profile,
      nextUpgrade: getNextUpgrade(profile),
      buildings: listBuildings(profile)
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
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: listBuildings(updatedProfile)
  });
});

router.post('/farm/upgrade', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  const count = req.body.count || 1;

  const result = upgradeFarm(profile, count);
  const updatedProfile = updateProfile(result.profile);

  if (result.upgraded > 0) {
    logFarmEvent(req.session.twitchUser.id, 'upgrade', {
      requested: count,
      upgraded: result.upgraded,
      totalCost: result.totalCost,
      totalParts: result.totalParts,
      stopReason: result.stopReason
    });
  }

  res.json({
    ok: result.ok,
    upgraded: result.upgraded,
    totalCost: result.totalCost,
    totalParts: result.totalParts,
    stopReason: result.stopReason,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: listBuildings(updatedProfile)
  });
});

router.post('/farm/test-balance', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  const result = addTestBalance(profile, 100000);
  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'test_balance', {
    amount: result.amount
  });

  res.json({
    ok: true,
    amount: result.amount,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: listBuildings(updatedProfile)
  });
});

router.post('/farm/buildings/:key/buy', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  const key = req.params.key;
  const result = buyBuilding(profile, key);

  if (!result.ok) {
    return res.json({
      ok: false,
      error: result.error,
      requiredLevel: result.requiredLevel,
      profile,
      nextUpgrade: getNextUpgrade(profile),
      buildings: listBuildings(profile)
    });
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'building_buy', {
    building: result.building,
    level: result.level,
    costCoins: result.costCoins,
    costParts: result.costParts
  });

  res.json({
    ok: true,
    action: 'buy',
    building: result.building,
    level: result.level,
    costCoins: result.costCoins,
    costParts: result.costParts,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: listBuildings(updatedProfile)
  });
});

router.post('/farm/buildings/:key/upgrade', requireAuth, (req, res) => {
  const profile = getUserProfile(req);
  const key = req.params.key;
  const count = req.body.count || 1;
  const result = upgradeBuilding(profile, key, count);

  if (!result.ok) {
    return res.json({
      ok: false,
      error: result.stopReason || result.error,
      stopReason: result.stopReason,
      upgraded: result.upgraded || 0,
      profile,
      nextUpgrade: getNextUpgrade(profile),
      buildings: listBuildings(profile)
    });
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'building_upgrade', {
    building: result.building,
    requested: count,
    upgraded: result.upgraded,
    totalCoins: result.totalCoins,
    totalParts: result.totalParts,
    stopReason: result.stopReason
  });

  res.json({
    ok: true,
    action: 'upgrade',
    building: result.building,
    upgraded: result.upgraded,
    totalCoins: result.totalCoins,
    totalParts: result.totalParts,
    stopReason: result.stopReason,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: listBuildings(updatedProfile)
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
      profile: updatedProfile,
      imported: result.imported,
      nextUpgrade: getNextUpgrade(updatedProfile),
      buildings: listBuildings(updatedProfile)
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
