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
  getBuildingState,
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

router.get('/me', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);

  res.json({
    ok: true,
    user: req.session.twitchUser,
    profile,
    nextUpgrade: getNextUpgrade(profile),
    buildings: getBuildingState(profile)
  });
});

router.post('/farm/collect', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = collectFarm(profile);

  if (!result.ok) return res.json(result);

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
    buildings: getBuildingState(updatedProfile)
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
      totalParts: result.totalParts,
      spentFarm: result.spentFarm,
      spentUpgrade: result.spentUpgrade
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
    buildings: getBuildingState(updatedProfile)
  });
});

router.post('/farm/test-balance', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = addTestBalance(profile, 100000);
  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'test_balance', { amount: result.amount });

  res.json({
    ok: true,
    amount: result.amount,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: getBuildingState(updatedProfile)
  });
});

router.get('/farm/buildings', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  res.json({ ok: true, buildings: getBuildingState(profile) });
});

router.post('/farm/buildings/buy', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;
  const result = buyBuilding(profile, key);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'building_buy', {
      key: result.key,
      name: result.name,
      cost: result.cost,
      parts: result.parts,
      spentFarm: result.spentFarm,
      spentUpgrade: result.spentUpgrade
    });
  }

  res.json({
    ...result,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: getBuildingState(updatedProfile)
  });
});

router.post('/farm/buildings/upgrade', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const key = req.body.key;
  const count = req.body.count || 1;
  const result = upgradeBuilding(profile, key, count);
  const updatedProfile = updateProfile(result.profile);

  if (result.ok) {
    logFarmEvent(req.session.twitchUser.id, 'building_upgrade', {
      key: result.key,
      name: result.name,
      count,
      upgraded: result.upgraded,
      level: result.level,
      totalCost: result.totalCost,
      totalParts: result.totalParts,
      spentFarm: result.spentFarm,
      spentUpgrade: result.spentUpgrade
    });
  }

  res.json({
    ...result,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile),
    buildings: getBuildingState(updatedProfile)
  });
});

router.post('/farm/sync-wizebot', requireAuth, async (req, res) => {
  try {
    const twitchUser = req.session.twitchUser;
    const profile = getProfile(twitchUser.id);

    const result = await syncWizebotFarmToProfile({ login: twitchUser.login, profile });

    if (!result.ok) return res.status(403).json(result);

    const updatedProfile = updateProfile(result.profile);

    logFarmEvent(twitchUser.id, 'sync_wizebot_api', { imported: result.imported });

    res.json({
      ok: true,
      profile: updatedProfile,
      imported: result.imported,
      nextUpgrade: getNextUpgrade(updatedProfile),
      buildings: getBuildingState(updatedProfile)
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
