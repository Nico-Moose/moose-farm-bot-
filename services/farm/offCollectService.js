const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { WIZEBOT } = require('./economyConfig');
const { estimateHourlyIncome } = require('./incomeService');

function offCollect(profile, now = Date.now()) {
  ensureFarmShape(profile);
  const last = num(profile.last_collect_at || profile.created_at || now, now);
  const diff = now - last;
  if (diff < WIZEBOT.COLLECT_COOLDOWN_MS) {
    return { ok: false, error: 'cooldown', remainingMs: WIZEBOT.COLLECT_COOLDOWN_MS - diff, profile };
  }

  const minutes = Math.min(60, Math.floor(diff / 60000));
  const hours = minutes / 60;

  // Оффсбор = 50% от всего дохода в час.
  // Сюда входят: пассив, растения, животные и монетные здания.
  const hourlyTotal = estimateHourlyIncome(profile) * hours;
  const income = Math.round(hourlyTotal * 0.5);

  // Запчасти = только завод / 2.
  // Для оффсбора берём именно базовое производство завода без бонусов шахты/фабрики.
  let partsIncome = 0;
  const lvl = num(profile.farm.buildings?.['завод'], 0);
  const conf = profile.configs.buildings?.['завод'];
  if (lvl > 0 && conf) {
    partsIncome = Math.floor((num(conf.baseProduction, 0) + num(conf.perLevel, 0) * Math.max(0, lvl - 1)) * 0.5);
  }

  profile.farm_balance = num(profile.farm_balance, 0) + income;
  profile.total_income = num(profile.total_income, 0) + income;
  profile.parts = num(profile.parts, 0) + partsIncome;
  profile.farm.resources.parts = profile.parts;
  profile.last_collect_at = now;
  profile.farm.lastWithdrawAt = now;

  return { ok: true, income, partsIncome, minutes, hourlyTotal: Math.round(hourlyTotal), profile };
}

module.exports = { offCollect };
