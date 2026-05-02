const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { spendCoins, addParts } = require('./walletService');

const CASE_COOLDOWN_MS = 60 * 60 * 1000;

const BASE_PRIZES = [
  { type: 'coins', value: 150000 }, { type: 'parts', value: 12500 }, { type: 'coins', value: 125000 }, { type: 'parts', value: 19000 }, { type: 'coins', value: 110000 },
  { type: 'parts', value: 15000 }, { type: 'coins', value: 180000 }, { type: 'parts', value: 17000 }, { type: 'coins', value: 135000 }, { type: 'parts', value: 13500 },
  { type: 'coins', value: 145000 }, { type: 'parts', value: 14500 }, { type: 'coins', value: 100000 }, { type: 'parts', value: 20000 }, { type: 'coins', value: 130000 },
  { type: 'parts', value: 16000 }, { type: 'coins', value: 155000 }, { type: 'parts', value: 12000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 15500 },
  { type: 'coins', value: 140000 }, { type: 'parts', value: 18000 }, { type: 'coins', value: 170000 }, { type: 'parts', value: 14000 }, { type: 'coins', value: 105000 },
  { type: 'parts', value: 16500 }, { type: 'coins', value: 160000 }, { type: 'parts', value: 17500 }, { type: 'coins', value: 115000 }, { type: 'parts', value: 13000 },
  { type: 'coins', value: 200000 }, { type: 'parts', value: 21000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 16000 }, { type: 'coins', value: 132000 },
  { type: 'parts', value: 22000 }, { type: 'coins', value: 190000 }, { type: 'parts', value: 15800 }, { type: 'coins', value: 128000 }
];

function getCaseTier(profile) {
  ensureFarmShape(profile);
  const level = num(profile.level, 0);
  const mineLevel = num(profile.farm.buildings?.['шахта'], 0);

  let cost = 1000;
  let baseMultiplier = 1;

  if (level >= 50) { cost = 2000; baseMultiplier = 2; }
  if (level >= 80) { cost = 4000; baseMultiplier = 4; }
  if (level >= 100) { cost = 8000; baseMultiplier = 8; }
  if (level >= 120) { cost = 16000; baseMultiplier = 14; }

  if (level >= 120) {
    if (mineLevel >= 200) { cost = 60000; baseMultiplier = 60; }
    else if (mineLevel >= 175) { cost = 55000; baseMultiplier = 55; }
    else if (mineLevel >= 150) { cost = 50000; baseMultiplier = 50; }
    else if (mineLevel >= 125) { cost = 45000; baseMultiplier = 45; }
    else if (mineLevel >= 100) { cost = 40000; baseMultiplier = 40; }
    else if (mineLevel >= 75) { cost = 35000; baseMultiplier = 35; }
    else if (mineLevel >= 50) { cost = 30000; baseMultiplier = 30; }
    else if (mineLevel >= 25) { cost = 20000; baseMultiplier = 25; }
  }

  return {
    unlocked: level >= 30,
    requiredLevel: 30,
    cost,
    baseMultiplier,
    mineLevel,
    minePercentMultiplier: 1 + mineLevel / 100,
    finalMultiplier: baseMultiplier * (1 + mineLevel / 100)
  };
}

function getCaseStatus(profile, now = Date.now()) {
  ensureFarmShape(profile);
  const tier = getCaseTier(profile);
  const lastCaseAt = num(profile.farm.lastCaseAt, 0);
  const caseCooldownUntil = num(profile.farm.caseCooldownUntil, 0);
  const nextCaseAt = Math.max(lastCaseAt + CASE_COOLDOWN_MS, caseCooldownUntil);

  return {
    ...tier,
    cooldownMs: CASE_COOLDOWN_MS,
    lastCaseAt,
    caseCooldownUntil,
    remainingMs: Math.max(0, nextCaseAt - now),
    history: Array.isArray(profile.farm.caseHistory) ? profile.farm.caseHistory.slice(0, 50) : []
  };
}

function openCase(profile, now = Date.now()) {
  ensureFarmShape(profile);

  const status = getCaseStatus(profile, now);
  if (!status.unlocked) {
    return { ok: false, error: 'farm_level_too_low', requiredLevel: status.requiredLevel, profile };
  }

  if (status.remainingMs > 0) {
    return { ok: false, error: 'cooldown', remainingMs: status.remainingMs, profile };
  }

  const paid = spendCoins(profile, status.cost, { mode: 'building' });
  if (!paid.ok) {
    return {
      ok: false,
      error: 'not_enough_money',
      needed: paid.needed,
      available: paid.available,
      missing: paid.missing,
      profile
    };
  }

  const index = Math.floor(Math.random() * BASE_PRIZES.length);
  const prize = BASE_PRIZES[index];
  const finalValue = Math.floor(prize.value * status.finalMultiplier);

  if (prize.type === 'coins') {
    profile.upgrade_balance = num(profile.upgrade_balance, 0) + finalValue;
  } else {
    addParts(profile, finalValue);
  }

  profile.farm.lastCaseAt = now;
  profile.farm.caseCooldownUntil = now + CASE_COOLDOWN_MS;
  profile.farm.caseHistory = Array.isArray(profile.farm.caseHistory) ? profile.farm.caseHistory : [];

  const record = {
    id: `${now}-${index}`,
    date: now,
    result: 'WIN',
    index,
    type: prize.type,
    value: finalValue,
    baseValue: prize.value,
    multiplier: status.finalMultiplier,
    cost: status.cost
  };

  profile.farm.caseHistory.unshift(record);
  profile.farm.caseHistory = profile.farm.caseHistory.slice(0, 50);

  profile.farm.caseStats = profile.farm.caseStats && typeof profile.farm.caseStats === 'object'
    ? profile.farm.caseStats
    : { opened: 0, spent: 0, coins: 0, parts: 0 };

  profile.farm.caseStats.opened = num(profile.farm.caseStats.opened, 0) + 1;
  profile.farm.caseStats.spent = num(profile.farm.caseStats.spent, 0) + status.cost;

  if (prize.type === 'coins') {
    profile.farm.caseStats.coins = num(profile.farm.caseStats.coins, 0) + finalValue;
  } else {
    profile.farm.caseStats.parts = num(profile.farm.caseStats.parts, 0) + finalValue;
  }

  return { ok: true, cost: status.cost, spent: paid.spent, prize: record, profile };
}

module.exports = { CASE_COOLDOWN_MS, BASE_PRIZES, getCaseTier, getCaseStatus, openCase };
