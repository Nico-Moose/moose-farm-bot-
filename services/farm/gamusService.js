const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { addParts } = require('./walletService');

function nextMoscowSix(now = Date.now()) {
  const d = new Date(now + 3 * 60 * 60 * 1000);
  let next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0, 0).getTime() - 3 * 60 * 60 * 1000;
  if (d.getHours() >= 6) next += 24 * 60 * 60 * 1000;
  return next;
}

function getRanges(profile) {
  ensureFarmShape(profile);
  const level = num(profile.level, 1);
  const mineLevel = num(profile.farm.buildings?.['шахта'], 0);
  let minMoney, maxMoney, minParts, maxParts, tierLevel;
  if (level < 20) { minMoney = 200000; maxMoney = 400000; minParts = 20000; maxParts = 40000; tierLevel = 1; }
  else if (level < 40) { minMoney = 400000; maxMoney = 550000; minParts = 40000; maxParts = 55000; tierLevel = 2; }
  else if (level < 60) { minMoney = 550000; maxMoney = 700000; minParts = 55000; maxParts = 70000; tierLevel = 3; }
  else if (level < 80) { minMoney = 700000; maxMoney = 900000; minParts = 70000; maxParts = 90000; tierLevel = 4; }
  else if (level < 100) { minMoney = 900000; maxMoney = 1200000; minParts = 90000; maxParts = 120000; tierLevel = 5; }
  else if (level < 120) { minMoney = 1200000; maxMoney = 1500000; minParts = 120000; maxParts = 1510000; tierLevel = 6; }
  else { minMoney = 1500000; maxMoney = 2000000; minParts = 150000; maxParts = 200000; tierLevel = 7; }

  if (mineLevel >= 100) { minMoney = 6000000; maxMoney = 10000000; minParts = 600000; maxParts = 1000000; tierLevel = 11; }
  else if (mineLevel >= 75) { minMoney = 4000000; maxMoney = 6000000; minParts = 400000; maxParts = 600000; tierLevel = 10; }
  else if (mineLevel >= 50) { minMoney = 3000000; maxMoney = 4000000; minParts = 300000; maxParts = 350000; tierLevel = 9; }
  else if (mineLevel >= 25) { minMoney = 1500000; maxMoney = 3000000; minParts = 150000; maxParts = 300000; tierLevel = 8; }

  const effectiveMineLevel = Math.min(Math.max(0, mineLevel), 300);
  const minePercentMultiplier = 1 + (effectiveMineLevel / 100);

  const baseMinMoney = minMoney;
  const baseMaxMoney = maxMoney;
  const baseMinParts = minParts;
  const baseMaxParts = maxParts;

  minMoney = Math.floor(baseMinMoney * minePercentMultiplier);
  maxMoney = Math.floor(baseMaxMoney * minePercentMultiplier);
  minParts = Math.floor(baseMinParts * minePercentMultiplier);
  maxParts = Math.floor(baseMaxParts * minePercentMultiplier);

  return {
    minMoney,
    maxMoney,
    minParts,
    maxParts,
    baseMinMoney,
    baseMaxMoney,
    baseMinParts,
    baseMaxParts,
    tierLevel,
    mineLevel,
    effectiveMineLevel,
    minePercentMultiplier
  };
}

function getGamusStatus(profile, now = Date.now()) {
  ensureFarmShape(profile);
  const last = num(profile.farm.lastGamusAt, 0);
  const nextReset = nextMoscowSix(now);
  const prevReset = nextReset - 24 * 60 * 60 * 1000;
  return { ranges: getRanges(profile), nextReset, lastGamusAt: last, available: last < prevReset, remainingMs: Math.max(0, nextReset - now) };
}

function randInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

function claimGamus(profile, now = Date.now()) {
  ensureFarmShape(profile);
  if (num(profile.level, 0) <= 0) return { ok: false, error: 'no_farm', profile };
  const status = getGamusStatus(profile, now);
  if (!status.available) return { ok: false, error: 'cooldown', remainingMs: status.remainingMs, profile };
  const r = status.ranges;

  const baseMoney = randInt(r.baseMinMoney || r.minMoney, r.baseMaxMoney || r.maxMoney);
  const baseParts = randInt(r.baseMinParts || r.minParts, r.baseMaxParts || r.maxParts);
  const multiplier = Number(r.minePercentMultiplier || 1);

  const money = Math.floor(baseMoney * multiplier);
  const parts = Math.floor(baseParts * multiplier);
  const mineBonusMoney = Math.max(0, money - baseMoney);
  const mineBonusParts = Math.max(0, parts - baseParts);

  profile.upgrade_balance = num(profile.upgrade_balance, 0) + money;
  addParts(profile, parts);
  profile.farm.lastGamusAt = now;

  return {
    ok: true,
    money,
    parts,
    baseMoney,
    baseParts,
    mineBonusMoney,
    mineBonusParts,
    mineLevel: r.mineLevel,
    effectiveMineLevel: r.effectiveMineLevel,
    tierLevel: r.tierLevel,
    nextReset: status.nextReset,
    profile
  };
}

module.exports = { nextMoscowSix, getGamusStatus, claimGamus };
