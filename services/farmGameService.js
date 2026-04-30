const MAX_LEVEL = 120;
const MAX_UPGRADE_PER_CLICK = 40;
const COLLECT_COOLDOWN_MS = 60 * 60 * 1000;

function calcUpgradeCost(lvl) {
  if (lvl < 30) return 75 * lvl;

  if (lvl < 60) {
    return 75 * lvl + 5000 + (lvl - 30) * 400;
  }

  if (lvl === 60) {
    return 300 * lvl + 1500;
  }

  if (lvl < 80) {
    return 300 * 60 + 1500 + (lvl - 60) * 500;
  }

  if (lvl === 80) {
    return 300 * 60 + 1500 + 20 * 500 + 2000;
  }

  if (lvl < 100) {
    return 300 * 60 + 1500 + 20 * 500 + 2000 + (lvl - 80) * 1000;
  }

  if (lvl === 100) {
    return 300 * 60 + 1500 + 20 * 500 + 2000 + 20 * 1000 + 1500;
  }

  return 300 * 60 + 1500 + 20 * 500 + 2000 + 20 * 1000 + 2000 + (lvl - 100) * 3000;
}

function getNextUpgrade(profile) {
  if (!profile || profile.level >= MAX_LEVEL) {
    return null;
  }

  const nextLevel = profile.level + 1;

  return {
    level: nextLevel,
    cost: calcUpgradeCost(nextLevel)
  };
}

function upgradeFarm(profile, count = 1) {
  const wanted = Math.min(
    Math.max(parseInt(count, 10) || 1, 1),
    MAX_UPGRADE_PER_CLICK
  );

  let upgraded = 0;
  let totalCost = 0;

  while (upgraded < wanted && profile.level < MAX_LEVEL) {
    const nextLevel = profile.level + 1;
    const cost = calcUpgradeCost(nextLevel);

    let available = profile.farm_balance + profile.upgrade_balance;
    if (available < cost) break;

    let need = cost;

    const fromFarm = Math.min(profile.farm_balance, need);
    profile.farm_balance -= fromFarm;
    need -= fromFarm;

    const fromUpgrade = Math.min(profile.upgrade_balance, need);
    profile.upgrade_balance -= fromUpgrade;
    need -= fromUpgrade;

    if (need > 0) break;

    profile.level = nextLevel;
    totalCost += cost;
    upgraded++;
  }

  return {
    ok: upgraded > 0,
    upgraded,
    totalCost,
    profile,
    nextUpgrade: getNextUpgrade(profile)
  };
}

function collectFarm(profile, now = Date.now()) {
  const last = profile.last_collect_at || profile.created_at || now;
  const diff = now - last;

  if (diff < COLLECT_COOLDOWN_MS) {
    return {
      ok: false,
      error: 'cooldown',
      remainingMs: COLLECT_COOLDOWN_MS - diff
    };
  }

  const minutes = Math.min(60, Math.floor(diff / 60000));
  const income = Math.round(profile.level * 2 * (minutes / 60));

  profile.farm_balance += income;
  profile.total_income += income;
  profile.last_collect_at = now;

  return {
    ok: true,
    income,
    minutes,
    profile
  };
}

function addTestBalance(profile, amount = 100000) {
  profile.farm_balance += amount;

  return {
    ok: true,
    amount,
    profile
  };
}

module.exports = {
  MAX_LEVEL,
  MAX_UPGRADE_PER_CLICK,
  COLLECT_COOLDOWN_MS,
  calcUpgradeCost,
  getNextUpgrade,
  upgradeFarm,
  collectFarm,
  addTestBalance
};
