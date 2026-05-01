const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { WIZEBOT } = require('./economyConfig');

function getPlantIncomePerHour(profile) {
  ensureFarmShape(profile);
  const level = num(profile.level, 0);
  let total = 0;
  for (const p of profile.configs.plants || []) {
    if (level >= num(p.level, 0)) {
      total += (num(p.base, 0) + num(p.perLevel, 0) * Math.max(0, level - 1)) * num(p.multiplier, 0);
    }
  }
  return total;
}

function getAnimalIncomePerHour(profile) {
  ensureFarmShape(profile);
  const level = num(profile.level, 0);
  let total = 0;
  for (const a of profile.configs.animals || []) {
    if (level >= num(a.level, 0)) {
      total += (num(a.base, 0) + num(a.perLevel, 0) * Math.max(0, level - 1)) * num(a.multiplier, 0);
    }
  }
  return total;
}

function getBuildingIncomePerHour(profile) {
  ensureFarmShape(profile);
  const buildingsConf = profile.configs.buildings || {};
  let coins = 0;
  let parts = 0;
  let shield = 0;
  let weapon = 0;

  for (const [key, lvlRaw] of Object.entries(profile.farm.buildings || {})) {
    const lvl = num(lvlRaw, 0);
    const conf = buildingsConf[key];
    if (!conf || lvl <= 0) continue;

    if (key !== 'шахта') {
      if (conf.coinsPerHour !== undefined) coins += num(conf.coinsPerHour, 0) * lvl;
      if (conf.coinsPerLevel !== undefined) coins += num(conf.coinsPerLevel, 0) * lvl;
    }

    if (key === 'завод') {
      parts += num(conf.baseProduction, 0) + num(conf.perLevel, 0) * Math.max(0, lvl - 1);
    }

    if (key === 'кузница') {
      weapon += num(conf.baseProduction, 0) + num(conf.perLevel, 0) * Math.max(0, lvl - 1);
    }

    if (key === 'укрепления') {
      shield += num(conf.baseProduction, 0) + num(conf.perLevel, 0) * Math.max(0, lvl - 1);
    }
  }

  const factoryLvl = num(profile.farm.buildings?.['фабрика'], 0);
  const mineLvl = num(profile.farm.buildings?.['шахта'], 0);
  const factoryBonusPercent = factoryLvl > 0
    ? num(buildingsConf['фабрика']?.baseProduction, 0) + num(buildingsConf['фабрика']?.perLevel, 0) * Math.max(0, factoryLvl - 1)
    : 0;

  const partsAfterFactory = parts * (1 + factoryBonusPercent / 100);
  const partsWithMine = partsAfterFactory + Math.round(partsAfterFactory * (mineLvl / 100));

  return {
    coins,
    parts,
    partsWithBonuses: partsWithMine,
    shield,
    weapon,
    factoryBonusPercent,
    mineBonusPercent: mineLvl
  };
}

function getPassiveIncomePerHour(profile) {
  ensureFarmShape(profile);
  return num(profile.level, 0) * 4 * 0.5;
}

function estimateHourlyIncome(profile) {
  const passive = getPassiveIncomePerHour(profile);
  const harvest = getPlantIncomePerHour(profile) + getAnimalIncomePerHour(profile);
  const buildings = getBuildingIncomePerHour(profile);
  return Math.floor(passive + harvest + buildings.coins);
}

function getAccumulatedPassive(profile, now = Date.now()) {
  ensureFarmShape(profile);
  const last = num(profile.last_collect_at || profile.created_at || now, now);
  const minutes = Math.min(60, Math.floor(Math.max(0, now - last) / 60000));
  const saved = num(profile.farm.savedPassive, 0);
  const maxPassive = getPassiveIncomePerHour(profile);
  const gained = getPassiveIncomePerHour(profile) * (minutes / 60);
  return Math.min(maxPassive, saved + gained);
}

function collectIncome(profile, now = Date.now()) {
  ensureFarmShape(profile);
  const last = num(profile.last_collect_at || profile.created_at || now, now);
  const diff = now - last;

  if (diff < WIZEBOT.COLLECT_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown', remainingMs: WIZEBOT.COLLECT_COOLDOWN_MS - diff };
  }

  const minutes = Math.min(60, Math.floor(diff / 60000));
  const hours = minutes / 60;
  const building = getBuildingIncomePerHour(profile);
  const passive = getPassiveIncomePerHour(profile) * hours;
  const harvest = (getPlantIncomePerHour(profile) + getAnimalIncomePerHour(profile)) * hours;
  const buildingCoins = building.coins * hours;
  const income = Math.floor(passive + harvest + buildingCoins);
  const partsIncome = Math.floor(building.partsWithBonuses * hours);
  const shieldIncome = Math.floor(building.shield * hours);
  const weaponIncome = Math.floor(building.weapon * hours);

  profile.farm_balance = num(profile.farm_balance, 0) + income;
  profile.total_income = num(profile.total_income, 0) + income;
  profile.parts = num(profile.parts, 0) + partsIncome;
  profile.last_collect_at = now;
  profile.farm.savedPassive = 0;
  profile.farm.resources.parts = profile.parts;
  profile.farm.resources.shield = num(profile.farm.resources.shield, 0) + shieldIncome;
  profile.farm.resources.weapon = num(profile.farm.resources.weapon, 0) + weaponIncome;

  return {
    ok: true,
    income,
    partsIncome,
    shieldIncome,
    weaponIncome,
    minutes,
    details: {
      passive: Math.floor(passive),
      harvest: Math.floor(harvest),
      buildingCoins: Math.floor(buildingCoins),
      factoryBonusPercent: building.factoryBonusPercent,
      mineBonusPercent: building.mineBonusPercent
    },
    profile
  };
}

module.exports = {
  getPlantIncomePerHour,
  getAnimalIncomePerHour,
  getBuildingIncomePerHour,
  getPassiveIncomePerHour,
  getAccumulatedPassive,
  estimateHourlyIncome,
  collectIncome
};
