const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { getTurretState } = require('./turretService');
const { WIZEBOT } = require('./economyConfig');
const { estimateHourlyIncome } = require('./incomeService');
const { getProtectionPercent } = require('./economyMath');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PROTECTED_USERS = ['nico_moose', 'zhelizabethsm949', 'enotikpalaskyn01'];

function getRaidCooldown(profile) {
  ensureFarmShape(profile);
  const centerLevel = num(profile.farm.buildings?.центр, 0);
  const minutes = WIZEBOT.RAID_BASE_COOLDOWN_MINUTES - Math.min(centerLevel * 5, WIZEBOT.RAID_CENTER_MAX_REDUCTION_MINUTES);
  return minutes * 60 * 1000;
}

function getRaidStatus(profile) {
  ensureFarmShape(profile);
  const now = Date.now();
  const lastRaidAt = num(profile.farm.lastRaidAt, 0);
  const cooldownMs = getRaidCooldown(profile);
  return {
    unlocked: num(profile.level, 0) >= 30,
    cooldownMs,
    lastRaidAt,
    remainingMs: Math.max(0, lastRaidAt + cooldownMs - now)
  };
}

function nick(profile) {
  return String(profile.login || profile.display_name || profile.twitch_id || '').toLowerCase();
}

function chooseTarget(attacker, candidates, now = Date.now()) {
  const attackerNick = nick(attacker);
  const filtered = candidates.filter((p) => {
    ensureFarmShape(p);
    const pNick = nick(p);
    const shieldUntil = num(p.farm.shieldUntil || p.farm.shield_until, 0);
    return p.twitch_id !== attacker.twitch_id &&
      num(p.level, 0) >= 60 &&
      pNick !== attackerNick &&
      !PROTECTED_USERS.includes(pNick) &&
      shieldUntil < now;
  });
  if (!filtered.length) return null;

  const weighted = [];
  filtered
    .map((p) => ({ profile: p, total: num(p.farm_balance, 0) + num(p.twitch_balance, 0) + num(p.upgrade_balance, 0) }))
    .sort((a, b) => b.total - a.total)
    .forEach((entry, index) => {
      let weight = 1;
      if (index === 0) weight = 10;
      else if (index === 1) weight = 8;
      else if (index === 2) weight = 5;
      else if (index === 3) weight = 3.5;
      else if (index === 4) weight = 3.2;
      else if (index === 5) weight = 3.0;
      else if (index === 6) weight = 2.6;
      else if (index === 7) weight = 2.4;
      else if (index === 8) weight = 2.2;
      else if (index === 9) weight = 2;
      if (entry.total < 0) weight /= 8;
      for (let i = 0; i < Math.max(1, Math.round(weight * 10)); i++) weighted.push(entry.profile);
    });

  return weighted[Math.floor(Math.random() * weighted.length)] || filtered[0];
}

function getInactiveMs(profile, now) {
  return now - num(profile.farm.lastWithdrawAt || profile.last_collect_at || profile.created_at || now, now);
}

function getPunishMultiplier(target, baseIncome, now) {
  let punishMult = 1;
  if (baseIncome < 1000) punishMult = Math.max(punishMult, 6);

  const inactive = getInactiveMs(target, now);
  if (inactive > 4 * WEEK_MS) punishMult = Math.max(punishMult, 8);
  else if (inactive > 3 * WEEK_MS) punishMult = Math.max(punishMult, 6);
  else if (inactive > 2 * WEEK_MS) punishMult = Math.max(punishMult, 4);
  else if (inactive > WEEK_MS) punishMult = Math.max(punishMult, 2);

  const permUsers = Array.isArray(target.farm.activePermUsers) ? target.farm.activePermUsers : [];
  if (permUsers.includes(nick(target))) punishMult = Math.max(punishMult, 8);
  return punishMult;
}

function getBonusRaid(target, attackerEfficiency) {
  const buildings = target.farm.buildings || {};
  const zavodLvl = num(buildings['завод'], 0);
  const fabrikaLvl = num(buildings['фабрика'], 0);
  const mineLvl = num(buildings['шахта'], 0);
  const zavodBonus = zavodLvl * 2000;
  const fabrikaBonus = fabrikaLvl * 4000;
  const mineBonus = Math.floor((zavodBonus + fabrikaBonus) * (mineLvl / 100));
  const total = zavodBonus + fabrikaBonus + mineBonus;
  const percent = Math.floor(attackerEfficiency / 5);
  return Math.floor(total * (percent / 100));
}


function spendMainThenFarm(profile, amount) {
  ensureFarmShape(profile);
  amount = Math.max(0, Math.floor(num(amount, 0)));

  let main = num(profile.twitch_balance, 0);
  let farm = num(profile.farm_balance, 0);
  const beforeMain = main;
  const beforeFarm = farm;

  const fromMain = Math.min(main, amount);
  main -= fromMain;
  const rest = amount - fromMain;
  farm -= rest; // может уйти в минус

  profile.twitch_balance = main;
  profile.farm_balance = farm;

  return {
    amount,
    from_main: fromMain,
    from_farm: rest,
    before_main: beforeMain,
    before_farm: beforeFarm,
    after_main: main,
    after_farm: farm,
    farm_debt_after: farm < 0 ? Math.abs(farm) : 0
  };
}

function applyTurretPenalty(attacker, target, income, targetTurret, turretChance) {
  const turretTriggered = targetTurret.level > 0 && Math.random() * 100 <= turretChance;
  if (!turretTriggered) {
    return { turretTriggered: false, turretPenalty: 0, killedByTurret: false, shieldReduce: 0 };
  }

  const lossPercent = WIZEBOT.TURRET_PENALTIES[targetTurret.level - 1] || 0;
  const rawLoss = Math.floor(income * lossPercent);
  const attackerProtectionPercent = getProtectionPercent(attacker.protection_level);
  let loss = Math.floor(rawLoss * (1 - attackerProtectionPercent / 100));
  if (loss < 0) loss = 0;

  const attackerShield = num(attacker.farm.resources?.shield, 0);
  const shieldReduce = Math.min(loss, attackerShield);
  loss -= shieldReduce;
  attacker.farm.resources.shield = attackerShield - shieldReduce;
  const spend = spendMainThenFarm(attacker, loss);

  return {
    turretTriggered: true,
    turretPenalty: loss,
    killedByTurret: loss >= income && income > 0,
    shieldReduce,
    spend
  };
}

function performRaid(attacker, candidates) {
  ensureFarmShape(attacker);
  const status = getRaidStatus(attacker);
  if (!status.unlocked) return { ok: false, error: 'farm_level_too_low', requiredLevel: 30, attacker };
  if (status.remainingMs > 0) return { ok: false, error: 'cooldown', remainingMs: status.remainingMs, attacker };

  const now = Date.now();
  const normalizedCandidates = candidates.map((p) => ensureFarmShape(p));
  const target = chooseTarget(attacker, normalizedCandidates, now);
  if (!target) return { ok: false, error: 'no_targets', attacker };

  const attackerLevel = num(attacker.level, 0);
  const raidBoost = num(attacker.raid_power, 0);
  const weaponBonus = num(attacker.farm.resources?.weapon, 0);
  attacker.farm.resources.weapon = 0;

  const efficiency = Math.min(attackerLevel, 200) + Math.min(raidBoost, 200) + weaponBonus;
  const raidMultiplier = efficiency / 100;
  const baseIncome = estimateHourlyIncome(target);
  const punishMult = getPunishMultiplier(target, baseIncome, now);
  const inactive = getInactiveMs(target, now);
  const ignoreProtection = inactive > 4 * WEEK_MS;

  let income = Math.floor(baseIncome * raidMultiplier * punishMult);

  let blockedByProtection = 0;
  const protectionPercent = getProtectionPercent(target.protection_level);
  if (!ignoreProtection && protectionPercent > 0) {
    blockedByProtection = Math.floor(income * (protectionPercent / 100));
    income -= blockedByProtection;
  }

  let shieldUsed = 0;
  if (!ignoreProtection) {
    const shield = num(target.farm.resources?.shield, 0);
    shieldUsed = Math.min(income, shield);
    income -= shieldUsed;
    target.farm.resources.shield = shield - shieldUsed;
  }

  const targetTurret = getTurretState(target);
  const jammerLevel = num(attacker.farm.buildings?.['глушилка'], 0);
  let turretChance = ignoreProtection ? 0 : Math.max(0, targetTurret.chance - jammerLevel * 5);
  turretChance = Math.min(100, turretChance);
  const turret = applyTurretPenalty(attacker, target, income, targetTurret, turretChance);

  const raidBlockedByTurret = !!turret.turretTriggered;
  let stolen = raidBlockedByTurret ? 0 : Math.max(0, income);

  const bonusStolen = getBonusRaid(target, efficiency);
  const actualBonusStolen = raidBlockedByTurret ? 0 : bonusStolen;

  const targetSpend = raidBlockedByTurret
    ? { amount: 0, from_main: 0, from_farm: 0, before_main: num(target.twitch_balance, 0), before_farm: num(target.farm_balance, 0), after_main: num(target.twitch_balance, 0), after_farm: num(target.farm_balance, 0), farm_debt_after: num(target.farm_balance, 0) < 0 ? Math.abs(num(target.farm_balance, 0)) : 0 }
    : spendMainThenFarm(target, stolen);

  if (!raidBlockedByTurret) {
    attacker.farm_balance = num(attacker.farm_balance, 0) + stolen;
  } else if (turret.turretPenalty > 0) {
    target.farm_balance = num(target.farm_balance, 0) + turret.turretPenalty;
  }

  target.upgrade_balance = num(target.upgrade_balance, 0) - actualBonusStolen;
  attacker.upgrade_balance = num(attacker.upgrade_balance, 0) + actualBonusStolen;
  attacker.farm.lastRaidAt = now;

  const log = {
    timestamp: now,
    attacker: nick(attacker),
    target: nick(target),
    strength: efficiency,
    punish_mult: punishMult,
    base_income: baseIncome,
    stolen,
    blocked: blockedByProtection + shieldUsed,
    turret_refund: turret.turretPenalty,
    attacker_loss: turret.turretPenalty,
    attacker_spend_main: turret.spend ? turret.spend.from_main : 0,
    attacker_spend_farm: turret.spend ? turret.spend.from_farm : 0,
    attacker_farm_after: num(attacker.farm_balance, 0),
    target_spend_main: targetSpend.from_main || 0,
    target_spend_farm: targetSpend.from_farm || 0,
    target_farm_after: num(target.farm_balance, 0),
    target_farm_debt_after: num(target.farm_balance, 0) < 0 ? Math.abs(num(target.farm_balance, 0)) : 0,
    bonus_stolen: actualBonusStolen,
    turret_bonus: 0,
    turret_chance: turretChance,
    turret_triggered: turret.turretTriggered,
    raid_blocked_by_turret: raidBlockedByTurret,
    killed_by_turret: raidBlockedByTurret,
    ignore_protection: ignoreProtection
  };

  attacker.farm.raidLogs = Array.isArray(attacker.farm.raidLogs) ? attacker.farm.raidLogs : [];
  target.farm.raidLogs = Array.isArray(target.farm.raidLogs) ? target.farm.raidLogs : [];
  attacker.farm.raidLogs.unshift(log);
  target.farm.raidLogs.unshift(log);
  attacker.farm.raidLogs = attacker.farm.raidLogs.slice(0, 50);
  target.farm.raidLogs = target.farm.raidLogs.slice(0, 50);

  return { ok: true, attacker, target, log, status: getRaidStatus(attacker) };
}

module.exports = {
  RAID_COOLDOWN_MS: WIZEBOT.RAID_BASE_COOLDOWN_MINUTES * 60 * 1000,
  WEEK_MS,
  getRaidStatus,
  getRaidCooldown,
  estimateHourlyIncome,
  performRaid
};
