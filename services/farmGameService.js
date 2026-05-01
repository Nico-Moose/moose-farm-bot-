const MAX_LEVEL = 120;
const MAX_UPGRADE_PER_CLICK = 40;
const COLLECT_COOLDOWN_MS = 60 * 60 * 1000;

const BUILDING_KEYS = [
  'завод',
  'фабрика',
  'кузница',
  'укрепления',
  'шахта',
  'глушилка',
  'центр'
];

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

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

function ensureFarmShape(profile) {
  profile.level = num(profile.level);
  profile.farm_balance = num(profile.farm_balance);
  profile.upgrade_balance = num(profile.upgrade_balance);
  profile.total_income = num(profile.total_income);
  profile.parts = num(profile.parts);
  profile.license_level = num(profile.license_level);
  profile.protection_level = num(profile.protection_level);
  profile.raid_power = num(profile.raid_power);

  profile.farm = profile.farm || {};
  profile.farm.resources = profile.farm.resources || {};
  profile.farm.buildings = profile.farm.buildings || {};
  profile.farm.unlocked_at = profile.farm.unlocked_at || {};
  profile.farm.unlocked_at_ani = profile.farm.unlocked_at_ani || {};

  profile.farm.level = profile.level;
  profile.farm.resources.parts = num(profile.farm.resources.parts, profile.parts);
  profile.parts = num(profile.farm.resources.parts, profile.parts);
  profile.configs = profile.configs || {};
}

function spendCoins(profile, cost) {
  let need = num(cost);
  const spent = { farm: 0, upgrade: 0 };

  const fromFarm = Math.min(profile.farm_balance, need);
  profile.farm_balance -= fromFarm;
  spent.farm += fromFarm;
  need -= fromFarm;

  const fromUpgrade = Math.min(profile.upgrade_balance, need);
  profile.upgrade_balance -= fromUpgrade;
  spent.upgrade += fromUpgrade;
  need -= fromUpgrade;

  return {
    ok: need <= 0,
    need,
    spent
  };
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

function upgradeFarm(profile, count = 1) {
  ensureFarmShape(profile);

  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), MAX_UPGRADE_PER_CLICK);

  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let totalSpentFarm = 0;
  let totalSpentUpgrade = 0;
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

    const spent = spendCoins(profile, cost);
    if (!spent.ok) {
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
    totalSpentFarm += spent.spent.farm;
    totalSpentUpgrade += spent.spent.upgrade;
    upgraded++;
  }

  return {
    ok: upgraded > 0,
    upgraded,
    totalCost,
    totalParts,
    spentFarm: totalSpentFarm,
    spentUpgrade: totalSpentUpgrade,
    stopReason,
    profile,
    nextUpgrade: getNextUpgrade(profile)
  };
}

function getBuildingConfig(profile, buildingKey) {
  return profile?.configs?.buildings?.[buildingKey] || null;
}

function getBuildingState(profile) {
  ensureFarmShape(profile);

  const buildingsConfig = profile.configs?.buildings || {};

  return BUILDING_KEYS.map((key) => {
    const conf = buildingsConfig[key] || null;
    const level = num(profile.farm.buildings[key]);
    const built = level > 0;
    const baseCost = conf ? num(conf.baseCost) : 0;
    const partsBase = conf ? num(conf.partsBase) : 0;
    const levelRequired = conf ? num(conf.levelRequired) : 0;
    const canBuy = !!conf && !built && profile.level >= levelRequired && profile.farm_balance + profile.upgrade_balance >= baseCost && profile.parts >= partsBase;

    return {
      key,
      name: conf?.name || key,
      level,
      built,
      levelRequired,
      buyCost: baseCost,
      buyParts: partsBase,
      canBuy,
      hasConfig: !!conf,
      maxLevel: conf ? num(conf.maxLevel) : 0
    };
  });
}

function buyBuilding(profile, buildingKey) {
  ensureFarmShape(profile);

  const key = String(buildingKey || '').trim().toLowerCase();
  if (!BUILDING_KEYS.includes(key)) {
    return { ok: false, error: 'unknown_building', profile };
  }

  const conf = getBuildingConfig(profile, key);
  if (!conf) {
    return { ok: false, error: 'building_config_missing', profile };
  }

  if (num(profile.farm.buildings[key]) > 0) {
    return { ok: false, error: 'building_already_built', profile };
  }

  const levelRequired = num(conf.levelRequired);
  if (profile.level < levelRequired) {
    return {
      ok: false,
      error: 'farm_level_too_low',
      requiredLevel: levelRequired,
      currentLevel: profile.level,
      profile
    };
  }

  const cost = num(conf.baseCost);
  const partsNeed = num(conf.partsBase);

  if (profile.parts < partsNeed) {
    return {
      ok: false,
      error: 'not_enough_parts',
      partsNeed,
      partsHave: profile.parts,
      profile
    };
  }

  if (profile.farm_balance + profile.upgrade_balance < cost) {
    return {
      ok: false,
      error: 'not_enough_money',
      cost,
      available: profile.farm_balance + profile.upgrade_balance,
      profile
    };
  }

  const spent = spendCoins(profile, cost);
  if (!spent.ok) {
    return { ok: false, error: 'not_enough_money', cost, profile };
  }

  if (partsNeed > 0) {
    profile.parts -= partsNeed;
    profile.farm.resources.parts = Math.max(0, num(profile.farm.resources.parts) - partsNeed);
  }

  profile.farm.buildings[key] = 1;

  return {
    ok: true,
    key,
    name: conf.name || key,
    level: 1,
    cost,
    parts: partsNeed,
    spentFarm: spent.spent.farm,
    spentUpgrade: spent.spent.upgrade,
    profile,
    buildings: getBuildingState(profile)
  };
}

function getMaxBuildingLevel(farmLevel) {
  const lvl = num(farmLevel);
  if (lvl < 40) return 5;
  if (lvl < 50) return 10;
  if (lvl < 60) return 22;
  if (lvl < 70) return 35;
  if (lvl < 80) return 60;
  if (lvl < 90) return 90;
  if (lvl < 100) return 120;
  if (lvl < 110) return 155;
  if (lvl < 120) return 200;
  return 1000;
}

function getForgeMaxLevel(farmLevel) {
  const lvl = num(farmLevel);
  if (lvl < 50) return 0;
  if (lvl < 60) return 2;
  if (lvl < 70) return 5;
  if (lvl < 80) return 8;
  if (lvl < 90) return 10;
  if (lvl < 100) return 14;
  return 1000;
}

function checkCustomUpgradeRestrictions(buildingKey, targetLevel, farm) {
  const lvl = farm.buildings || {};

  if (buildingKey === 'фабрика' && targetLevel > 5) {
    if (num(lvl['завод']) < 10) {
      return 'factory_requires_zavod_10';
    }
  }

  if (buildingKey === 'шахта') {
    if (targetLevel <= 25) {
      if (num(lvl['завод']) < 50 || num(lvl['фабрика']) < 50) return 'mine_requires_zavod_factory_50';
    } else if (targetLevel <= 50) {
      if (num(lvl['завод']) < 100 || num(lvl['фабрика']) < 100) return 'mine_requires_zavod_factory_100';
    } else if (targetLevel <= 75) {
      if (num(lvl['завод']) < 125 || num(lvl['фабрика']) < 125) return 'mine_requires_zavod_factory_125';
    } else if (targetLevel <= 100) {
      if (num(lvl['завод']) < 200 || num(lvl['фабрика']) < 200) return 'mine_requires_zavod_factory_200';
    } else if (targetLevel >= 200) {
      if (num(lvl['завод']) < 300 || num(lvl['фабрика']) < 300) return 'mine_requires_zavod_factory_300';
    }
  }

  return null;
}

function upgradeBuilding(profile, buildingKey, count = 1) {
  ensureFarmShape(profile);

  const key = String(buildingKey || '').trim().toLowerCase();
  const wanted = Math.min(Math.max(parseInt(count, 10) || 1, 1), 100);

  if (!BUILDING_KEYS.includes(key)) return { ok: false, error: 'unknown_building', profile };

  const conf = getBuildingConfig(profile, key);
  if (!conf) return { ok: false, error: 'building_config_missing', profile };

  let currentLevel = num(profile.farm.buildings[key]);
  if (currentLevel <= 0) return { ok: false, error: 'building_not_built', profile };

  if (profile.level < num(conf.levelRequired)) {
    return { ok: false, error: 'farm_level_too_low', requiredLevel: num(conf.levelRequired), currentLevel: profile.level, profile };
  }

  const allowedMax = key === 'кузница' ? getForgeMaxLevel(profile.level) : getMaxBuildingLevel(profile.level);
  const maxLevel = Math.min(num(conf.maxLevel, allowedMax), allowedMax);

  let upgraded = 0;
  let totalCost = 0;
  let totalParts = 0;
  let spentFarm = 0;
  let spentUpgrade = 0;
  let stopReason = null;

  while (upgraded < wanted && currentLevel < maxLevel) {
    const nextLevel = currentLevel + 1;
    const restriction = checkCustomUpgradeRestrictions(key, nextLevel, profile.farm);
    if (restriction) {
      stopReason = restriction;
      break;
    }

    const cost = num(conf.baseCost) + (nextLevel - 1) * num(conf.costIncreasePerLevel);
    const partsNeed = num(conf.partsBase) + (nextLevel - 1) * num(conf.partsPerLevel);

    if (profile.parts < partsNeed) {
      stopReason = 'not_enough_parts';
      break;
    }

    if (profile.farm_balance + profile.upgrade_balance < cost) {
      stopReason = 'not_enough_money';
      break;
    }

    const spent = spendCoins(profile, cost);
    if (!spent.ok) {
      stopReason = 'not_enough_money';
      break;
    }

    if (partsNeed > 0) {
      profile.parts -= partsNeed;
      profile.farm.resources.parts = Math.max(0, num(profile.farm.resources.parts) - partsNeed);
    }

    currentLevel = nextLevel;
    profile.farm.buildings[key] = currentLevel;

    upgraded++;
    totalCost += cost;
    totalParts += partsNeed;
    spentFarm += spent.spent.farm;
    spentUpgrade += spent.spent.upgrade;
  }

  return {
    ok: upgraded > 0,
    key,
    name: conf.name || key,
    upgraded,
    level: currentLevel,
    maxLevel,
    totalCost,
    totalParts,
    spentFarm,
    spentUpgrade,
    stopReason,
    profile,
    buildings: getBuildingState(profile)
  };
}

function collectFarm(profile, now = Date.now()) {
  ensureFarmShape(profile);

  const last = profile.last_collect_at || profile.created_at || now;
  const diff = now - last;

  if (diff < COLLECT_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown', remainingMs: COLLECT_COOLDOWN_MS - diff };
  }

  const minutes = Math.min(60, Math.floor(diff / 60000));
  const hours = minutes / 60;

  let income = 0;
  let partsIncome = 0;

  const plants = profile.configs?.plants || [];
  const animals = profile.configs?.animals || [];
  const buildings = profile.farm?.buildings || {};
  const buildingsConfig = profile.configs?.buildings || {};

  const levelIncome = profile.level * 2 * hours;
  income += levelIncome;

  for (const plant of plants) {
    if (profile.level < num(plant.level)) continue;
    const value = (num(plant.base) + num(plant.perLevel) * (profile.level - 1)) * num(plant.multiplier);
    income += value * hours;
  }

  for (const animal of animals) {
    if (profile.level < num(animal.level)) continue;
    const value = (num(animal.base) + num(animal.perLevel) * (profile.level - 1)) * num(animal.multiplier);
    income += value * hours;
  }

  for (const key of Object.keys(buildings)) {
    const lvl = num(buildings[key]);
    const conf = buildingsConfig[key];
    if (!conf || lvl <= 0) continue;

    if (conf.coinsPerHour !== undefined) income += num(conf.coinsPerHour) * lvl * hours;
    if (conf.coinsPerLevel !== undefined) income += num(conf.coinsPerLevel) * lvl;

    if (key === 'завод') {
      const base = num(conf.baseProduction);
      const per = num(conf.perLevel);
      let produced = Math.floor((base + per * (lvl - 1)) * hours);

      const factoryLvl = num(buildings['фабрика']);
      const mineLvl = num(buildings['шахта']);
      if (factoryLvl > 0) produced = Math.floor(produced * (1 + factoryLvl * 0.10));
      if (mineLvl > 0) produced = Math.floor(produced * (1 + mineLvl / 100));

      partsIncome += produced;
    }
  }

  income = Math.floor(income);

  profile.farm_balance += income;
  profile.total_income += income;
  profile.parts += partsIncome;
  profile.farm.resources.parts = num(profile.farm.resources.parts) + partsIncome;
  profile.last_collect_at = now;

  return { ok: true, income, partsIncome, minutes, profile };
}

function addTestBalance(profile, amount = 100000) {
  ensureFarmShape(profile);
  profile.farm_balance += num(amount, 100000);
  return { ok: true, amount: num(amount, 100000), profile };
}

module.exports = {
  MAX_LEVEL,
  MAX_UPGRADE_PER_CLICK,
  COLLECT_COOLDOWN_MS,
  BUILDING_KEYS,
  calcUpgradeCost,
  getNextUpgrade,
  upgradeFarm,
  collectFarm,
  addTestBalance,
  getBuildingState,
  buyBuilding,
  upgradeBuilding
};
