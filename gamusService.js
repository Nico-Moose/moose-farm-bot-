const { num } = require('./numberUtils');
const { ensureFarmShape } = require('./profileShape');
const { spendCoins, refundCoins, spendParts, getWallet } = require('./walletService');
const { WIZEBOT } = require('./economyConfig');
const {
  getBuildingBuyCost,
  getBuildingUpgradeCost,
  getMaxBuildingLevel: calcMaxBuildingLevel
} = require('./economyMath');

const BUILDING_ORDER = ['завод', 'фабрика', 'кузница', 'укрепления', 'шахта', 'глушилка', 'центр'];

function getBuildingConfig(profile, key) {
  ensureFarmShape(profile);
  return profile.configs.buildings[key] || null;
}

function getBuildingLevel(profile, key) {
  ensureFarmShape(profile);
  return num(profile.farm.buildings[key], 0);
}

function getMaxBuildingLevel(profile, key, conf) {
  return calcMaxBuildingLevel(profile.level, key, conf?.maxLevel ?? 1000);
}

function checkCustomUpgradeRestrictions(profile, key, targetLevel) {
  const buildings = profile.farm.buildings || {};
  const current = (name) => num(buildings[name], 0);
  const check = (name, required) => ({ name, required, current: current(name), ok: current(name) >= required });

  if (key === 'фабрика' && targetLevel > 5 && current('завод') < 10) {
    return { code: 'factory_requires_zavod_10', requirements: [check('завод', 10)] };
  }

  if (key === 'шахта') {
    if (targetLevel <= 25 && (current('завод') < 50 || current('фабрика') < 50)) {
      return { code: 'mine_requires_zavod_50_factory_50', requirements: [check('завод', 50), check('фабрика', 50)] };
    }
    if (targetLevel <= 50 && (current('завод') < 100 || current('фабрика') < 100)) {
      return { code: 'mine_requires_zavod_100_factory_100', requirements: [check('завод', 100), check('фабрика', 100)] };
    }
    if (targetLevel <= 75 && (current('завод') < 125 || current('фабрика') < 125)) {
      return { code: 'mine_requires_zavod_125_factory_125', requirements: [check('завод', 125), check('фабрика', 125)] };
    }
    if (targetLevel <= 100 && (current('завод') < 200 || current('фабрика') < 200)) {
      return { code: 'mine_requires_zavod_200_factory_200', requirements: [check('завод', 200), check('фабрика', 200)] };
    }
    if (targetLevel >= 200 && (current('завод') < 300 || current('фабрика') < 300)) {
      return { code: 'mine_requires_zavod_300_factory_300', requirements: [check('завод', 300), check('фабрика', 300)] };
    }
  }

  return null;
}

function addAffordability(cost, profile) {
  const wallet = getWallet(profile);
  return {
    ...cost,
    availableCoins: wallet.total,
    availableParts: wallet.parts,
    missingCoins: Math.max(0, num(cost.coins, 0) - wallet.total),
    missingParts: Math.max(0, num(cost.parts, 0) - wallet.parts)
  };
}

function getBuildingState(profile, key) {
  ensureFarmShape(profile);
  const conf = getBuildingConfig(profile, key);
  if (!conf) return null;

  const level = getBuildingLevel(profile, key);
  const maxLevel = getMaxBuildingLevel(profile, key, conf);
  const levelRequired = num(conf.levelRequired, 0);
  const canAccess = num(profile.level, 0) >= levelRequired;
  const buyCost = addAffordability(getBuildingBuyCost(conf), profile);
  const nextLevel = level + 1;
  const upgradeCostRaw = getBuildingUpgradeCost(conf, nextLevel);
  const restriction = level > 0 ? checkCustomUpgradeRestrictions(profile, key, nextLevel) : null;

  return {
    key,
    name: conf.name || key,
    level,
    maxLevel,
    levelRequired,
    canAccess,
    isBuilt: level > 0,
    canUpgrade: level > 0 && level < maxLevel && !restriction,
    buyCost,
    nextLevel,
    upgradeCost: addAffordability(upgradeCostRaw, profile),
    restriction
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
  if (!conf) return { ok: false, error: 'building_not_found', profile };

  const state = getBuildingState(profile, key);
  if (!state.canAccess) return { ok: false, error: 'farm_level_too_low', requiredLevel: state.levelRequired, state, profile };
  if (state.isBuilt) return { ok: false, error: 'building_already_built', state, profile };

  const cost = state.buyCost;
  if (cost.missingCoins > 0) return { ok: false, error: 'not_enough_money', cost, profile };
  if (cost.missingParts > 0) return { ok: false, error: 'not_enough_parts', cost, profile };

  const money = spendCoins(profile, cost.coins, { mode: 'building' });
  if (!money.ok) return { ok: false, error: 'not_enough_money', cost: { ...cost, missingCoins: money.missing }, profile };

  const parts = spendParts(profile, cost.parts);
  if (!parts.ok) {
    refundCoins(profile, money.spent);
    return { ok: false, error: 'not_enough_parts', cost: { ...cost, missingParts: parts.missing }, profile };
  }

  profile.farm.buildings[key] = 1;

  return {
    ok: true,
    action: 'buy',
    building: key,
    name: state.name,
    level: 1,
    totalCost: cost.coins,
    totalParts: cost.parts,
    spent: money.spent,
    profile,
    buildings: listBuildings(profile)
  };
}

function upgradeBuilding(profile, key, count = 1) {
  ensureFarmShape(profile);
  const conf = getBuildingConfig(profile, key);
  if (!conf) return { ok: false, error: 'building_not_found', profile };
  if (!profile.farm.buildings[key]) return { ok: false, error: 'building_not_built', profile };

  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), WIZEBOT.MAX_BUILDING_UPGRADE_PER_ACTION);
  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let stopReason = null;
  let restriction = null;
  let lastCost = null;
  let spent = { farm_balance: 0, twitch_balance: 0, upgrade_balance: 0 };

  while (upgraded < wanted) {
    const currentLevel = getBuildingLevel(profile, key);
    const maxLevel = getMaxBuildingLevel(profile, key, conf);
    if (currentLevel >= maxLevel) { stopReason = 'max_level'; break; }

    const nextLevel = currentLevel + 1;
    restriction = checkCustomUpgradeRestrictions(profile, key, nextLevel);
    if (restriction) { stopReason = restriction.code; break; }

    const rawCost = getBuildingUpgradeCost(conf, nextLevel);
    const cost = addAffordability(rawCost, profile);
    lastCost = { ...cost, level: nextLevel };
    if (cost.missingCoins > 0) { stopReason = 'not_enough_money'; break; }
    if (cost.missingParts > 0) { stopReason = 'not_enough_parts'; break; }

    const money = spendCoins(profile, cost.coins, { mode: 'building' });
    if (!money.ok) { stopReason = 'not_enough_money'; lastCost.missingCoins = money.missing; break; }
    const parts = spendParts(profile, cost.parts);
    if (!parts.ok) {
      refundCoins(profile, money.spent);
      stopReason = 'not_enough_parts';
      lastCost.missingParts = parts.missing;
      break;
    }

    spent.farm_balance += money.spent.farm_balance;
    spent.twitch_balance += money.spent.twitch_balance;
    spent.upgrade_balance += money.spent.upgrade_balance;
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
    spent,
    stopReason,
    error: stopReason,
    restriction,
    cost: lastCost,
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
