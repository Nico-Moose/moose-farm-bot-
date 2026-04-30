const express = require('express');
const { getProfile, updateProfile, logFarmEvent } = require('../services/userService');
const { getNextUpgrade, upgradeFarm, collectFarm, addTestBalance } = require('../services/farmGameService');
const { syncWizebotFarmToProfile } = require('../services/wizebotSyncService');
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
    nextUpgrade: getNextUpgrade(profile)
  });
});

router.post('/farm/collect', requireAuth, (req, res) => {
  const profile = getProfile(req.session.twitchUser.id);
  const result = collectFarm(profile);

  if (!result.ok) {
    return res.json(result);
  }

  const updatedProfile = updateProfile(result.profile);

  logFarmEvent(req.session.twitchUser.id, 'collect', {
    income: result.income,
    minutes: result.minutes
  });

  res.json({
    ok: true,
    income: result.income,
    minutes: result.minutes,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile)
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
      totalCost: result.totalCost
    });
  }

  res.json({
    ok: result.ok,
    upgraded: result.upgraded,
    totalCost: result.totalCost,
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile)
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
    profile: updatedProfile,
    nextUpgrade: getNextUpgrade(updatedProfile)
  });
});

module.exports = router;
