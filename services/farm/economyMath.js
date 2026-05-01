const { num } = require('./numberUtils');
const { WIZEBOT } = require('./economyConfig');

function calcFarmUpgradeCost(level) {
  const lvl = num(level, 0);
  if (lvl < 30) return 75 * lvl;
  if (lvl < 60) return (75 * lvl) + 5000 + ((lvl - 30) * 400);
  if (lvl === 60) return (300 * lvl) + 1500;
  if (lvl < 80) return (300 * 60) + 1500 + (lvl - 60) * 500;
  if (lvl === 80) return (300 * 60) + 1500 + (20 * 500) + 2000;
  if (lvl < 100) return (300 * 60) + 1500 + (20 * 500) + 2000 + (lvl - 80) * 1000;
  if (lvl === 100) return (300 * 60) + 1500 + (20 * 500) + 2000 + (20 * 1000) + 1500;
  return (300 * 60) + 1500 + (20 * 500) + 2000 + (20 * 1000) + 2000 + (lvl - 100) * 3000;
}

function getMaxBuildingLevel(farmLevel, key, configMax = 1000) {
  const lvl = num(farmLevel, 0);
  const max = num(configMax, 1000);

  if (key === 'кузница') {
    if (lvl < 50) return 0;
    if (lvl < 60) return Math.min(max, 2);
    if (lvl < 70) return Math.min(max, 5);
    if (lvl < 80) return Math.min(max, 8);
    if (lvl < 90) return Math.min(max, 10);
    if (lvl < 100) return Math.min(max, 14);
    return max;
  }

  if (lvl < 40) return Math.min(max, 5);
  if (lvl < 50) return Math.min(max, 10);
  if (lvl < 60) return Math.min(max, 22);
  if (lvl < 70) return Math.min(max, 35);
  if (lvl < 80) return Math.min(max, 60);
  if (lvl < 90) return Math.min(max, 90);
  if (lvl < 100) return Math.min(max, 120);
  if (lvl < 110) return Math.min(max, 155);
  if (lvl < 120) return Math.min(max, 200);
  return max;
}

function getBuildingBuyCost(conf) {
  return {
    coins: num(conf?.baseCost, 0),
    parts: num(conf?.partsBase, 0)
  };
}

function getBuildingUpgradeCost(conf, nextLevel) {
  return {
    coins: num(conf?.baseCost, 0) + (num(nextLevel, 1) - 1) * num(conf?.costIncreasePerLevel, 0),
    parts: num(conf?.partsBase, 0) + (num(nextLevel, 1) - 1) * num(conf?.partsPerLevel, 0)
  };
}

function getRaidUpgradeCost(currentLevel) {
  return WIZEBOT.RAID_UPGRADE_BASE_PRICE * (num(currentLevel, 0) + 1);
}

function getProtectionPercent(level) {
  return num(level, 0) * WIZEBOT.PROTECTION_PERCENT_PER_LEVEL;
}

function calcProgressiveUpgrade({ currentLevel, requestedCount, maxLevel, available }) {
  const current = num(currentLevel, 0);
  const max = num(maxLevel, 0);
  let requested = Math.max(1, parseInt(requestedCount, 10) || 1);
  requested = Math.min(requested, Math.max(0, max - current));

  let totalCost = 0;
  let affordableCount = 0;
  const have = num(available, 0);

  for (let i = 0; i < requested; i++) {
    const price = WIZEBOT.RAID_UPGRADE_BASE_PRICE * (current + 1 + i);
    if (have >= totalCost + price) {
      totalCost += price;
      affordableCount++;
    } else {
      break;
    }
  }

  return {
    requested,
    upgraded: affordableCount,
    totalCost,
    nextCost: current >= max ? null : getRaidUpgradeCost(current),
    missing: affordableCount > 0 ? 0 : Math.max(0, getRaidUpgradeCost(current) - have)
  };
}

module.exports = {
  calcFarmUpgradeCost,
  getMaxBuildingLevel,
  getBuildingBuyCost,
  getBuildingUpgradeCost,
  getRaidUpgradeCost,
  getProtectionPercent,
  calcProgressiveUpgrade
};
