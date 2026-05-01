const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { getTurretState } = require('./turretService');

const RAID_COOLDOWN_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getRaidCooldown(profile) {
  ensureFarmShape(profile);
  const centerLevel = num(profile.farm.buildings?.центр, 0);
  const minutes = 60 - Math.min(centerLevel * 5, 45);
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

function estimateHourlyIncome(profile) {
  ensureFarmShape(profile);
  const level = num(profile.level, 0);
  const buildingsConf = profile.configs.buildings || {};
  let buildingIncome = 0;

  for (const [key, lvlRaw] of Object.entries(profile.farm.buildings || {})) {
    const lvl = num(lvlRaw, 0);
    const conf = buildingsConf[key];
    if (!conf || lvl <= 0) continue;
    if (conf.coinsPerHour) buildingIncome += num(conf.coinsPerHour, 0) * lvl;
    if (conf.coinsPerLevel) buildingIncome += num(conf.coinsPerLevel, 0) * lvl;
  }

  let harvest = 0;
  for (const p of profile.configs.plants || []) {
    if (level >= num(p.level, 0)) harvest += (num(p.base, 0) + num(p.perLevel, 0) * Math.max(0, level - 1)) * num(p.multiplier, 0);
  }
  for (const a of profile.configs.animals || []) {
    if (level >= num(a.level, 0)) harvest += (num(a.base, 0) + num(a.perLevel, 0) * Math.max(0, level - 1)) * num(a.multiplier, 0);
  }

  return Math.floor(level * 2 + buildingIncome + harvest);
}

function chooseTarget(attacker, candidates) {
  const filtered = candidates.filter((p) => p.twitch_id !== attacker.twitch_id && num(p.level, 0) >= 60);
  if (!filtered.length) return null;

  const weighted = [];
  filtered
    .map((p) => ({ profile: p, total: num(p.farm_balance, 0) + num(p.upgrade_balance, 0) }))
    .sort((a, b) => b.total - a.total)
    .forEach((entry, index) => {
      let weight = 1;
      if (index === 0) weight = 10;
      else if (index === 1) weight = 8;
      else if (index === 2) weight = 5;
      else if (index === 3) weight = 3.5;
      else if (index === 4) weight = 3.2;
      else if (index < 10) weight = 2;
      if (entry.total < 0) weight /= 8;
      for (let i = 0; i < Math.max(1, Math.round(weight * 10)); i++) weighted.push(entry.profile);
    });

  return weighted[Math.floor(Math.random() * weighted.length)] || filtered[0];
}

function performRaid(attacker, candidates) {
  ensureFarmShape(attacker);
  const status = getRaidStatus(attacker);
  if (!status.unlocked) return { ok: false, error: 'farm_level_too_low', requiredLevel: 30, attacker };
  if (status.remainingMs > 0) return { ok: false, error: 'cooldown', remainingMs: status.remainingMs, attacker };

  const target = chooseTarget(attacker, candidates.map((p) => ensureFarmShape(p)));
  if (!target) return { ok: false, error: 'no_targets', attacker };

  const now = Date.now();
  const attackerLevel = num(attacker.level, 0);
  const raidPower = num(attacker.raid_power, 0);
  const weaponBonus = num(attacker.farm.resources.weapon, 0);
  attacker.farm.resources.weapon = 0;

  const efficiency = Math.min(attackerLevel, 200) + Math.min(raidPower, 200) + weaponBonus;
  let multiplier = Math.max(0.01, efficiency / 100);
  let baseIncome = estimateHourlyIncome(target);
  let punishMult = baseIncome < 1000 ? 6 : 1;

  const lastCollect = num(target.last_collect_at || target.farm.lastWithdrawAt, 0);
  const inactive = lastCollect ? now - lastCollect : 0;
  if (inactive > 4 * WEEK_MS) punishMult = Math.max(punishMult, 8);
  else if (inactive > 3 * WEEK_MS) punishMult = Math.max(punishMult, 6);
  else if (inactive > 2 * WEEK_MS) punishMult = Math.max(punishMult, 4);
  else if (inactive > WEEK_MS) punishMult = Math.max(punishMult, 2);

  let stolen = Math.floor(baseIncome * multiplier * punishMult);
  const protectionPercent = num(target.protection_level, 0) * 0.5;
  const ignoreProtection = inactive > 4 * WEEK_MS;
  let blockedByProtection = 0;
  if (!ignoreProtection && protectionPercent > 0) {
    blockedByProtection = Math.floor(stolen * (protectionPercent / 100));
    stolen -= blockedByProtection;
  }

  let shieldUsed = 0;
  if (!ignoreProtection) {
    const shield = num(target.farm.resources.shield, 0);
    shieldUsed = Math.min(shield, stolen);
    stolen -= shieldUsed;
    target.farm.resources.shield = shield - shieldUsed;
  }

  const targetTurret = getTurretState(target);
  const jammerLevel = num(attacker.farm.buildings?.глушилка, 0);
  let turretChance = ignoreProtection ? 0 : Math.max(0, targetTurret.chance - jammerLevel * 5);
  turretChance = Math.min(100, turretChance);
  const turretTriggered = targetTurret.level > 0 && Math.random() * 100 <= turretChance;

  let turretPenalty = 0;
  let killedByTurret = false;
  if (turretTriggered) {
    const penalties = [0.05,0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45,0.50,0.60,0.70,0.80,0.90,1.00,1.10,1.25,1.50,1.75,2.00];
    turretPenalty = Math.floor(stolen * (penalties[targetTurret.level - 1] || 0));
    const attackerProtection = num(attacker.protection_level, 0) * 0.5;
    turretPenalty = Math.floor(turretPenalty * (1 - attackerProtection / 100));
    attacker.farm_balance = num(attacker.farm_balance, 0) - turretPenalty;
    killedByTurret = turretPenalty >= stolen && stolen > 0;
    if (killedByTurret) stolen = 0;
  }

  stolen = Math.max(0, stolen);
  target.farm_balance = num(target.farm_balance, 0) - stolen;
  attacker.farm_balance = num(attacker.farm_balance, 0) + stolen;
  attacker.farm.lastRaidAt = now;

  const log = {
    timestamp: now,
    attacker: attacker.login || attacker.display_name || attacker.twitch_id,
    target: target.login || target.display_name || target.twitch_id,
    strength: efficiency,
    punish_mult: punishMult,
    base_income: baseIncome,
    stolen,
    blocked: blockedByProtection + shieldUsed,
    turret_chance: turretChance,
    turret_penalty: turretPenalty,
    killed_by_turret: killedByTurret
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
  RAID_COOLDOWN_MS,
  getRaidStatus,
  estimateHourlyIncome,
  performRaid
};
