const { num } = require('./numberUtils');
const { ensureFarmShape } = require('./profileShape');
const { spendCoins, spendParts } = require('./paymentService');

const BUILDING_ORDER = [
  'завод',
  'фабрика',
  'кузница',
  'укрепления',
  'шахта',
  'глушилка',
  'центр'
];

function getBuildingConfig(profile, key) {
  ensureFarmShape(profile);
  return profile.configs.buildings[key] || null;
}

function getBuildingLevel(profile, key) {
  ensureFarmShape(profile);
  return num(profile.farm.buildings[key], 0);
}

function getBuildingBuyCost(conf) {
  return {
    coins: num(conf.baseCost, 0),
    parts: num(conf.partsBase, 0)
  };
}

function getBuildingUpgradeCost(conf, nextLevel) {
  return {
    coins: num(conf.baseCost, 0) + (nextLevel - 1) * num(conf.costIncreasePerLevel, 0),
    parts: num(conf.partsBase, 0) + (nextLevel - 1) * num(conf.partsPerLevel, 0)
  };
}

function getMaxBuildingLevel(profile, key, conf) {
  ensureFarmShape(profile);

  const farmLevel = num(profile.level, 0);
  const configMax = num(conf.maxLevel, 1000);

  if (key === 'кузница') {
    if (farmLevel < 50) return 0;
    if (farmLevel < 60) return Math.min(configMax, 2);
    if (farmLevel < 70) return Math.min(configMax, 5);
    if (farmLevel < 80) return Math.min(configMax, 8);
    if (farmLevel < 90) return Math.min(configMax, 10);
    if (farmLevel < 100) return Math.min(configMax, 14);
    return configMax;
  }

  if (farmLevel < 40) return Math.min(configMax, 5);
  if (farmLevel < 50) return Math.min(configMax, 10);
  if (farmLevel < 60) return Math.min(configMax, 22);
  if (farmLevel < 70) return Math.min(configMax, 35);
  if (farmLevel < 80) return Math.min(configMax, 60);
  if (farmLevel < 90) return Math.min(configMax, 90);
  if (farmLevel < 100) return Math.min(configMax, 120);
  if (farmLevel < 110) return Math.min(configMax, 155);
  if (farmLevel < 120) return Math.min(configMax, 200);
  return configMax;
}

function checkCustomUpgradeRestrictions(profile, key, targetLevel) {
  const buildings = profile.farm.buildings || {};

  function current(name) {
    return num(buildings[name], 0);
  }

  if (key === 'фабрика' && targetLevel > 5 && current('завод') < 10) {
    return 'factory_requires_zavod_10';
  }

  if (key === 'шахта') {
    if (targetLevel <= 25 && (current('завод') < 50 || current('фабрика') < 50)) {
      return 'mine_requires_zavod_50_factory_50';
    }
    if (targetLevel <= 50 && (current('завод') < 100 || current('фабрика') < 100)) {
      return 'mine_requires_zavod_100_factory_100';
    }
    if (targetLevel <= 75 && (current('завод') < 125 || current('фабрика') < 125)) {
      return 'mine_requires_zavod_125_factory_125';
    }
    if (targetLevel <= 100 && (current('завод') < 200 || current('фабрика') < 200)) {
      return 'mine_requires_zavod_200_factory_200';
    }
    if (targetLevel >= 200 && (current('завод') < 300 || current('фабрика') < 300)) {
      return 'mine_requires_zavod_300_factory_300';
    }
  }

  return null;
}

function getBuildingState(profile, key) {
  ensureFarmShape(profile);

  const conf = getBuildingConfig(profile, key);
  if (!conf) return null;

  const level = getBuildingLevel(profile, key);
  const maxLevel = getMaxBuildingLevel(profile, key, conf);
  const levelRequired = num(conf.levelRequired, 0);
  const canAccess = profile.level >= levelRequired;

  const buyCost = getBuildingBuyCost(conf);
  const nextLevel = level + 1;
  const upgradeCost = getBuildingUpgradeCost(conf, nextLevel);

  return {
    key,
    name: conf.name || key,
    level,
    maxLevel,
    levelRequired,
    canAccess,
    isBuilt: level > 0,
    canUpgrade: level > 0 && level < maxLevel,
    buyCost,
    nextLevel,
    upgradeCost
  };
}

function listBuildings(profile) {
  ensureFarmShape(profile);

  const keys = [
    ...BUILDING_ORDER.filter((key) => profile.configs.buildings[key]),
    ...Object.keys(profile.configs.buildings).filter((key) => !BUILDING_ORDER.includes(key))
  ];

  return keys.map((key) => getBuildingState(profile, key)).filter(Boolean);
}

function buyBuilding(profile, key) {
  ensureFarmShape(profile);

  const conf = getBuildingConfig(profile, key);
  if (!conf) return { ok: false, error: 'building_not_found' };

  const state = getBuildingState(profile, key);

  if (!state.canAccess) {
    return { ok: false, error: 'farm_level_too_low', requiredLevel: state.levelRequired };
  }

  if (state.isBuilt) {
    return { ok: false, error: 'building_already_built' };
  }

  const money = spendCoins(profile, state.buyCost.coins);
  if (!money.ok) return { ok: false, error: 'not_enough_money' };

  const parts = spendParts(profile, state.buyCost.parts);
  if (!parts.ok) {
    profile.farm_balance += money.spent.farm_balance;
    profile.upgrade_balance += money.spent.upgrade_balance;
    return { ok: false, error: 'not_enough_parts' };
  }

  profile.farm.buildings[key] = 1;

  return {
    ok: true,
    action: 'buy',
    building: key,
    name: state.name,
    level: 1,
    totalCost: state.buyCost.coins,
    totalParts: state.buyCost.parts,
    profile,
    buildings: listBuildings(profile)
  };
}

function upgradeBuilding(profile, key, count = 1) {
  ensureFarmShape(profile);

  const conf = getBuildingConfig(profile, key);
  if (!conf) return { ok: false, error: 'building_not_found' };

  if (!profile.farm.buildings[key]) {
    return { ok: false, error: 'building_not_built' };
  }

  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), 40);
  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let stopReason = null;

  while (upgraded < wanted) {
    const currentLevel = getBuildingLevel(profile, key);
    const maxLevel = getMaxBuildingLevel(profile, key, conf);

    if (currentLevel >= maxLevel) {
      stopReason = 'max_level';
      break;
    }

    const nextLevel = currentLevel + 1;
    const restriction = checkCustomUpgradeRestrictions(profile, key, nextLevel);
    if (restriction) {
      stopReason = restriction;
      break;
    }

    const cost = getBuildingUpgradeCost(conf, nextLevel);

    const money = spendCoins(profile, cost.coins);
    if (!money.ok) {
      stopReason = 'not_enough_money';
      break;
    }

    const parts = spendParts(profile, cost.parts);
    if (!parts.ok) {
      profile.farm_balance += money.spent.farm_balance;
      profile.upgrade_balance += money.spent.upgrade_balance;
      stopReason = 'not_enough_parts';
      break;
    }

    profile.farm.buildings[key] = nextLevel;
    totalCost += cost.coins;
    totalParts += cost.parts;
    upgraded++;
  }

  return {
    ok: upgraded > 0,
    action: 'upgrade',
    building: key,
    name: conf.name || key,
    upgraded,
    totalCost,
    totalParts,
    stopReason,
    profile,
    buildings: listBuildings(profile)
  };
}

module.exports = {
  BUILDING_ORDER,
  listBuildings,
  getBuildingState,
  buyBuilding,
  upgradeBuilding,
  getBuildingBuyCost,
  getBuildingUpgradeCost,
  getMaxBuildingLevel
};
