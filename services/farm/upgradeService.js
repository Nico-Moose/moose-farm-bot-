const { num } = require('./numberUtils');
const { ensureFarmShape } = require('./profileShape');
const { spendMoney, spendParts } = require('./paymentService');

const MAX_LEVEL = 120;
const MAX_UPGRADE_PER_CLICK = 40;

function calcUpgradeCost(lvl) {
  if (lvl < 30) return 75 * lvl;
  if (lvl < 60) return 75 * lvl + 5000 + (lvl - 30) * 400;
  if (lvl === 60) return 300 * lvl + 1500;
  if (lvl < 80) return 300 * 60 + 1500 + (lvl - 60) * 500;
  if (lvl === 80) return 300 * 60 + 1500 + 20 * 500 + 2000;
  if (lvl < 100) return 300 * 60 + 1500 + 20 * 500 + 2000 + (lvl - 80) * 1000;
  if (lvl === 100) return 300 * 60 + 1500 + 20 * 500 + 2000 + 20 * 1000 + 1500;
  return 300 * 60 + 1500 + 20 * 500 + 2000 + 20 * 1000 + 2000 + (lvl - 100) * 3000;
}

function getPartsRequired(profile, level) {
  const required = profile?.configs?.parts_required || {};
  return num(required[String(level)] ?? required[level], 0);
}

function getLicenseCost(profile, level) {
  const licenses = profile?.configs?.licenses || {};
  return num(licenses[String(level)] ?? licenses[level], 0);
}

function isLicenseRequired(profile, level) {
  return getLicenseCost(profile, level) > 0 && num(profile.license_level, 0) < level;
}

function getNextUpgrade(profile) {
  if (!profile) return null;
  ensureFarmShape(profile);

  if (profile.level >= MAX_LEVEL) return null;

  const nextLevel = profile.level + 1;

  return {
    level: nextLevel,
    cost: calcUpgradeCost(nextLevel),
    parts: getPartsRequired(profile, nextLevel),
    licenseRequired: isLicenseRequired(profile, nextLevel),
    licenseCost: getLicenseCost(profile, nextLevel)
  };
}

function upgradeFarm(profile, count = 1) {
  ensureFarmShape(profile);

  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), MAX_UPGRADE_PER_CLICK);

  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let stopReason = null;

  while (upgraded < wanted && profile.level < MAX_LEVEL) {
    const nextLevel = profile.level + 1;
    const cost = calcUpgradeCost(nextLevel);
    const partsNeed = getPartsRequired(profile, nextLevel);

    if (isLicenseRequired(profile, nextLevel)) {
      stopReason = 'license_required';
      break;
    }

    if (profile.parts < partsNeed) {
      stopReason = 'not_enough_parts';
      break;
    }

    const moneyResult = spendMoney(profile, cost);
    if (!moneyResult.ok) {
      stopReason = 'not_enough_money';
      break;
    }

    const partsResult = spendParts(profile, partsNeed);
    if (!partsResult.ok) {
      stopReason = 'not_enough_parts';
      break;
    }

    profile.level = nextLevel;
    profile.farm.level = nextLevel;

    totalCost += cost;
    totalParts += partsNeed;
    upgraded++;
  }

  return {
    ok: upgraded > 0,
    upgraded,
    totalCost,
    totalParts,
    stopReason,
    profile,
    nextUpgrade: getNextUpgrade(profile)
  };
}

module.exports = {
  MAX_LEVEL,
  MAX_UPGRADE_PER_CLICK,
  calcUpgradeCost,
  getPartsRequired,
  getLicenseCost,
  isLicenseRequired,
  getNextUpgrade,
  upgradeFarm
};
