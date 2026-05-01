const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { getPassiveIncomePerHour, getPlantIncomePerHour, getAnimalIncomePerHour, getBuildingIncomePerHour, estimateHourlyIncome } = require('./incomeService');
const { getRaidStatus } = require('./raidService');
const { getTurretState } = require('./turretService');

function getFarmInfo(profile) {
  ensureFarmShape(profile);
  const building = getBuildingIncomePerHour(profile);
  const passive = getPassiveIncomePerHour(profile);
  const plants = getPlantIncomePerHour(profile);
  const animals = getAnimalIncomePerHour(profile);
  const buildings = Object.entries(profile.farm.buildings || {}).map(([key, level]) => ({ key, level: num(level, 0), config: profile.configs.buildings?.[key] || {} }));
  return {
    level: num(profile.level, 0),
    balances: { farm: num(profile.farm_balance, 0), twitch: num(profile.twitch_balance, 0), upgrade: num(profile.upgrade_balance, 0), parts: num(profile.parts, 0), totalCoins: num(profile.farm_balance, 0) + num(profile.twitch_balance, 0) + num(profile.upgrade_balance, 0) },
    hourly: { passive, plants, animals, buildingCoins: building.coins, parts: building.partsWithBonuses, shield: building.shield, weapon: building.weapon, total: estimateHourlyIncome(profile) },
    buildings,
    protection: { level: num(profile.protection_level, 0), percent: num(profile.protection_level, 0) * 0.5 },
    raid: getRaidStatus(profile),
    turret: getTurretState(profile)
  };
}

function getRaidInfo(profile) {
  ensureFarmShape(profile);
  const logs = Array.isArray(profile.farm.raidLogs) ? profile.farm.raidLogs : [];
  return {
    status: getRaidStatus(profile),
    power: num(profile.raid_power, 0),
    protection: num(profile.protection_level, 0),
    logs: logs.slice(0, 50),
    today: summarizeRaidLogs(logs, 1),
    week: summarizeRaidLogs(logs, 7),
    twoWeeks: summarizeRaidLogs(logs, 14)
  };
}

function summarizeRaidLogs(logs, days = 14) {
  const cutoff = Date.now() - days * 86400000;
  const filtered = logs.filter((e) => num(e.timestamp, 0) >= cutoff);
  return filtered.reduce((acc, e) => {
    acc.count += 1;
    acc.stolen += num(e.stolen, 0);
    acc.bonus += num(e.bonus_stolen, 0) + num(e.turret_bonus, 0);
    acc.blocked += num(e.blocked, 0) + num(e.turret_refund, 0);
    return acc;
  }, { count: 0, stolen: 0, bonus: 0, blocked: 0 });
}

function getTopRaids(profiles, days = 14) {
  const cutoff = Date.now() - days * 86400000;
  const map = new Map();
  function row(nick) {
    if (!map.has(nick)) map.set(nick, { nick, money: 0, bonus: 0, attacks: 0, defends: 0 });
    return map.get(nick);
  }
  for (const p of profiles) {
    ensureFarmShape(p);
    const logs = Array.isArray(p.farm.raidLogs) ? p.farm.raidLogs : [];
    for (const e of logs) {
      if (num(e.timestamp, 0) < cutoff) continue;
      const attacker = String(e.attacker || '').toLowerCase() || 'unknown';
      const target = String(e.target || e.defender || '').toLowerCase() || 'unknown';
      const killed = !!e.killed_by_turret;
      const stolen = num(e.stolen, 0);
      const bonus = num(e.bonus_stolen, 0) + num(e.turret_bonus, 0);
      const a = row(attacker);
      const d = row(target);
      a.money += killed ? -stolen : stolen;
      d.money += killed ? stolen : -stolen;
      a.bonus += killed ? -bonus : bonus;
      d.bonus += killed ? bonus : -bonus;
      a.attacks += 1;
      d.defends += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.money - a.money).slice(0, 50);
}

function getTopProfiles(profiles) {
  return profiles.map((p) => {
    ensureFarmShape(p);
    return { nick: p.login || p.display_name || p.twitch_id, level: num(p.level, 0), farm_balance: num(p.farm_balance, 0), twitch_balance: num(p.twitch_balance, 0), upgrade_balance: num(p.upgrade_balance, 0), parts: num(p.parts, 0), total: num(p.farm_balance, 0) + num(p.twitch_balance, 0) + num(p.upgrade_balance, 0) };
  }).sort((a, b) => b.total - a.total).slice(0, 50);
}

module.exports = { getFarmInfo, getRaidInfo, summarizeRaidLogs, getTopRaids, getTopProfiles };
