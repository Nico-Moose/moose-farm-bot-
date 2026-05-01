const MAX_LEVEL = 120;
const MAX_UPGRADE_PER_CLICK = 40;
const COLLECT_COOLDOWN_MS = 60 * 60 * 1000;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

function getPartsRequired(profile, level) {
  const required = profile?.configs?.parts_required || {};
  return num(required[String(level)], 0);
}

function getLicenseCost(profile, level) {
  const licenses = profile?.configs?.licenses || {};
  return num(licenses[String(level)] || licenses[level], 0);
}

function isLicenseRequired(profile, level) {
  return getLicenseCost(profile, level) > 0 && num(profile.license_level, 0) < level;
}

function getNextUpgrade(profile) {
  if (!profile || num(profile.level) >= MAX_LEVEL) return null;

  const nextLevel = num(profile.level) + 1;

  return {
    level: nextLevel,
    cost: calcUpgradeCost(nextLevel),
    parts: getPartsRequired(profile, nextLevel),
    licenseRequired: isLicenseRequired(profile, nextLevel),
    licenseCost: getLicenseCost(profile, nextLevel)
  };
}

function ensureFarmShape(profile) {
  profile.level = num(profile.level);
  profile.farm_balance = num(profile.farm_balance);
  profile.upgrade_balance = num(profile.upgrade_balance);
  profile.total_income = num(profile.total_income);
  profile.parts = num(profile.parts);

  profile.farm = profile.farm || {};
  profile.farm.resources = profile.farm.resources || {};

  if (!profile.farm.resources.parts) {
    profile.farm.resources.parts = profile.parts;
  }

  profile.farm.level = profile.level;
}

function upgradeFarm(profile, count = 1) {
  ensureFarmShape(profile);

  const wanted = Math.min(
    Math.max(parseInt(count, 10) || 1, 1),
    MAX_UPGRADE_PER_CLICK
  );

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

    const available = profile.farm_balance + profile.upgrade_balance;
    if (available < cost) {
      stopReason = 'not_enough_money';
      break;
    }

    let need = cost;

    const fromFarm = Math.min(profile.farm_balance, need);
    profile.farm_balance -= fromFarm;
    need -= fromFarm;

    const fromUpgrade = Math.min(profile.upgrade_balance, need);
    profile.upgrade_balance -= fromUpgrade;
    need -= fromUpgrade;

    if (need > 0) {
      stopReason = 'not_enough_money';
      break;
    }

    if (partsNeed > 0) {
      profile.parts -= partsNeed;
      profile.farm.resources.parts = Math.max(0, num(profile.farm.resources.parts) - partsNeed);
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

function collectFarm(profile, now = Date.now()) {
  ensureFarmShape(profile);

  const last = num(profile.last_collect_at || profile.created_at || now);
  const diff = now - last;

  if (diff < COLLECT_COOLDOWN_MS) {
    return {
      ok: false,
      error: 'cooldown',
      remainingMs: COLLECT_COOLDOWN_MS - diff
    };
  }

  const minutes = Math.min(60, Math.floor(diff / 60000));

  const levelIncome = profile.level * 2 * (minutes / 60);
  let buildingIncome = 0;
  let partsIncome = 0;

  const buildings = profile.farm.buildings || {};
  const buildingsConfig = profile.configs?.buildings || {};

  for (const key of Object.keys(buildings)) {
    if (key === 'шахта') continue;

    const lvl = num(buildings[key]);
    const conf = buildingsConfig[key];

    if (!conf || lvl <= 0) continue;

    if (conf.coinsPerHour !== undefined) {
      buildingIncome += num(conf.coinsPerHour) * lvl * (minutes / 60);
    }

    if (conf.coinsPerLevel !== undefined) {
      buildingIncome += num(conf.coinsPerLevel) * lvl;
    }

    if (key === 'завод') {
      const baseProduction = num(conf.baseProduction);
      const perLevel = num(conf.perLevel);
      partsIncome += Math.floor((baseProduction + perLevel * (lvl - 1)) * (minutes / 60));
    }
  }

  const income = Math.round(levelIncome + buildingIncome);

  profile.farm_balance += income;
  profile.total_income += income;
  profile.parts += partsIncome;
  profile.farm.resources.parts = num(profile.farm.resources.parts) + partsIncome;
  profile.last_collect_at = now;

  return {
    ok: true,
    income,
    partsIncome,
    minutes,
    profile
  };
}

function addTestBalance(profile, amount = 100000) {
  ensureFarmShape(profile);

  profile.farm_balance += num(amount, 100000);

  return {
    ok: true,
    amount: num(amount, 100000),
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
