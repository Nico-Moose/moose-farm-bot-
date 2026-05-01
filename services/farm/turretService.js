const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { spendCoins, spendParts } = require('./paymentService');

const DEFAULT_UPGRADES = [
  { chance: 5, cost: 15000, parts: 2500 },
  { chance: 10, cost: 50000, parts: 5000 },
  { chance: 15, cost: 100000, parts: 25000 },
  { chance: 20, cost: 500000, parts: 100000 },
  { chance: 25, cost: 2000000, parts: 250000 },
  { chance: 30, cost: 10000000, parts: 500000 },
  { chance: 35, cost: 50000000, parts: 1000000 },
  { chance: 40, cost: 100000000, parts: 10000000 },
  { chance: 45, cost: 150000000, parts: 20000000 },
  { chance: 50, cost: 250000000, parts: 30000000 },
  { chance: 55, cost: 500000000, parts: 40000000 },
  { chance: 60, cost: 600000000, parts: 50000000 },
  { chance: 65, cost: 750000000, parts: 60000000 },
  { chance: 70, cost: 850000000, parts: 70000000 },
  { chance: 75, cost: 900000000, parts: 80000000 },
  { chance: 80, cost: 1000000000, parts: 90000000 },
  { chance: 85, cost: 1500000000, parts: 150000000 },
  { chance: 90, cost: 2500000000, parts: 250000000 },
  { chance: 95, cost: 3500000000, parts: 500000000 },
  { chance: 100, cost: 5000000000, parts: 700000000 }
];

function getUpgrades(profile) {
  ensureFarmShape(profile);
  const arr = profile.configs.turret_upgrades;
  return Array.isArray(arr) && arr.length ? arr : DEFAULT_UPGRADES;
}

function getTurretState(profile) {
  ensureFarmShape(profile);
  const upgrades = getUpgrades(profile);
  const level = Math.max(0, num(profile.turret.level, 0));
  const current = level > 0 ? upgrades[level - 1] : null;
  const next = upgrades[level] || null;
  return {
    level,
    maxLevel: upgrades.length,
    chance: current ? num(current.chance, 0) : 0,
    nextUpgrade: next ? {
      level: level + 1,
      chance: num(next.chance, 0),
      cost: num(next.cost, 0),
      parts: num(next.parts, 0)
    } : null
  };
}

function upgradeTurret(profile) {
  ensureFarmShape(profile);
  const state = getTurretState(profile);
  if (!state.nextUpgrade) return { ok: false, error: 'max_level', profile, turret: state };

  const cost = state.nextUpgrade.cost;
  const partsCost = state.nextUpgrade.parts;

  const money = spendCoins(profile, cost);
  if (!money.ok) {
    return { ok: false, error: 'not_enough_money', needed: cost, available: money.available, profile, turret: state };
  }

  const parts = spendParts(profile, partsCost);
  if (!parts.ok) {
    profile.farm_balance += money.spent.farm_balance;
    profile.upgrade_balance += money.spent.upgrade_balance;
    return { ok: false, error: 'not_enough_parts', needed: partsCost, available: parts.available, profile, turret: state };
  }

  profile.turret.level = state.level + 1;
  return {
    ok: true,
    level: profile.turret.level,
    totalCost: cost,
    totalParts: partsCost,
    profile,
    turret: getTurretState(profile)
  };
}

module.exports = {
  getTurretState,
  upgradeTurret
};
