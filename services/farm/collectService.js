const { num } = require('./numberUtils');
const { ensureFarmShape } = require('./profileShape');

const COLLECT_COOLDOWN_MS = 60 * 60 * 1000;

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
  const hours = minutes / 60;

  let income = 0;
  let partsIncome = 0;

  const plants = profile.configs.plants || [];
  const animals = profile.configs.animals || [];
  const buildings = profile.farm.buildings || {};
  const buildingsConfig = profile.configs.buildings || {};

  income += profile.level * 2 * hours;

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

    if (conf.coinsPerHour !== undefined) {
      income += num(conf.coinsPerHour) * lvl * hours;
    }

    if (conf.coinsPerLevel !== undefined) {
      income += num(conf.coinsPerLevel) * lvl;
    }

    if (key === 'завод') {
      const base = num(conf.baseProduction);
      const per = num(conf.perLevel);
      partsIncome += Math.floor((base + per * (lvl - 1)) * hours);
    }
  }

  income = Math.floor(income);

  profile.farm_balance += income;
  profile.total_income += income;
  profile.parts += partsIncome;
  profile.farm.resources.parts = profile.parts;
  profile.last_collect_at = now;

  return {
    ok: true,
    income,
    partsIncome,
    minutes,
    profile
  };
}

module.exports = {
  COLLECT_COOLDOWN_MS,
  collectFarm
};
