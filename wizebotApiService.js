const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { spendCoins, spendParts, getWallet } = require('./walletService');
const { WIZEBOT } = require('./economyConfig');
const { calcFarmUpgradeCost } = require('./economyMath');

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
  if (num(profile.level, 0) >= WIZEBOT.MAX_FARM_LEVEL) return null;
  const level = num(profile.level, 0) + 1;
  const cost = calcFarmUpgradeCost(level);
  const parts = getPartsRequired(profile, level);
  const wallet = getWallet(profile);
  return {
    level,
    cost,
    parts,
    licenseRequired: isLicenseRequired(profile, level),
    licenseCost: getLicenseCost(profile, level),
    currentLicense: num(profile.license_level, 0),
    availableCoins: wallet.total,
    availableParts: wallet.parts,
    missingCoins: Math.max(0, cost - wallet.total),
    missingParts: Math.max(0, parts - wallet.parts)
  };
}

function upgradeFarm(profile, count = 1) {
  ensureFarmShape(profile);
  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), WIZEBOT.MAX_FARM_UPGRADE_PER_ACTION);
  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let stopReason = null;
  let requiredLicense = null;
  let lastNeed = null;
  let spent = { farm_balance: 0, twitch_balance: 0, upgrade_balance: 0 };

  while (upgraded < wanted && num(profile.level, 0) < WIZEBOT.MAX_FARM_LEVEL) {
    const nextLevel = num(profile.level, 0) + 1;
    const cost = calcFarmUpgradeCost(nextLevel);
    const partsNeed = getPartsRequired(profile, nextLevel);
    const wallet = getWallet(profile);
    lastNeed = { level: nextLevel, cost, parts: partsNeed, wallet };

    if (isLicenseRequired(profile, nextLevel)) {
      stopReason = 'license_required';
      requiredLicense = { level: nextLevel, cost: getLicenseCost(profile, nextLevel), current: num(profile.license_level, 0) };
      break;
    }
    if (wallet.parts < partsNeed) { stopReason = 'not_enough_parts'; break; }
    if (wallet.total < cost) { stopReason = 'not_enough_money'; break; }

    const coinResult = spendCoins(profile, cost, { mode: 'farm_upgrade' });
    if (!coinResult.ok) { stopReason = 'not_enough_money'; break; }
    const partsResult = spendParts(profile, partsNeed);
    if (!partsResult.ok) { stopReason = 'not_enough_parts'; break; }

    spent.farm_balance += coinResult.spent.farm_balance;
    spent.twitch_balance += coinResult.spent.twitch_balance;
    spent.upgrade_balance += coinResult.spent.upgrade_balance;
    profile.level = nextLevel;
    profile.farm.level = nextLevel;
    totalCost += cost;
    totalParts += partsNeed;
    upgraded++;
  }

  const wallet = getWallet(profile);
  return {
    ok: upgraded > 0,
    upgraded,
    totalCost,
    totalParts,
    spent,
    stopReason,
    requiredLicense,
    needed: lastNeed ? {
      level: lastNeed.level,
      cost: lastNeed.cost,
      parts: lastNeed.parts,
      availableCoins: lastNeed.wallet.total,
      availableParts: lastNeed.wallet.parts,
      missingCoins: Math.max(0, lastNeed.cost - lastNeed.wallet.total),
      missingParts: Math.max(0, lastNeed.parts - lastNeed.wallet.parts)
    } : null,
    wallet,
    profile,
    nextUpgrade: getNextUpgrade(profile)
  };
}

module.exports = {
  MAX_LEVEL: WIZEBOT.MAX_FARM_LEVEL,
  MAX_UPGRADE_PER_CLICK: WIZEBOT.MAX_FARM_UPGRADE_PER_ACTION,
  calcUpgradeCost: calcFarmUpgradeCost,
  getPartsRequired,
  getLicenseCost,
  isLicenseRequired,
  getNextUpgrade,
  upgradeFarm
};
