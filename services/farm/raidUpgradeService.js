const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { WIZEBOT } = require('./economyConfig');
const { calcProgressiveUpgrade, getRaidUpgradeCost, getProtectionPercent } = require('./economyMath');

function getStatus(profile) {
  ensureFarmShape(profile);
  const raidPower = num(profile.raid_power, 0);
  const protectionLevel = num(profile.protection_level, 0);
  const upgradeBalance = num(profile.upgrade_balance, 0);
  return {
    raidPower: {
      level: raidPower,
      maxLevel: WIZEBOT.RAID_POWER_MAX,
      nextCost: raidPower >= WIZEBOT.RAID_POWER_MAX ? null : getRaidUpgradeCost(raidPower),
      available: upgradeBalance,
      missing: raidPower >= WIZEBOT.RAID_POWER_MAX ? 0 : Math.max(0, getRaidUpgradeCost(raidPower) - upgradeBalance),
      unlocked: num(profile.level, 0) >= 120
    },
    protection: {
      level: protectionLevel,
      maxLevel: WIZEBOT.PROTECTION_MAX,
      percent: getProtectionPercent(protectionLevel),
      nextCost: protectionLevel >= WIZEBOT.PROTECTION_MAX ? null : getRaidUpgradeCost(protectionLevel),
      available: upgradeBalance,
      missing: protectionLevel >= WIZEBOT.PROTECTION_MAX ? 0 : Math.max(0, getRaidUpgradeCost(protectionLevel) - upgradeBalance),
      unlocked: num(profile.level, 0) >= 120
    }
  };
}

function buyProgressiveLevels(profile, field, maxLevel, requestedCount) {
  ensureFarmShape(profile);
  if (num(profile.level, 0) < 120) return { ok: false, error: 'farm_level_too_low', requiredLevel: 120, profile };

  const current = num(profile[field], 0);
  if (current >= maxLevel) return { ok: false, error: 'max_level', profile };

  const calc = calcProgressiveUpgrade({
    currentLevel: current,
    requestedCount,
    maxLevel,
    available: num(profile.upgrade_balance, 0)
  });

  if (calc.upgraded <= 0) {
    return {
      ok: false,
      error: 'not_enough_upgrade_balance',
      needed: calc.nextCost,
      available: num(profile.upgrade_balance, 0),
      missing: calc.missing,
      profile
    };
  }

  profile.upgrade_balance = num(profile.upgrade_balance, 0) - calc.totalCost;
  profile[field] = current + calc.upgraded;

  return {
    ok: true,
    upgraded: calc.upgraded,
    level: profile[field],
    totalCost: calc.totalCost,
    requested: calc.requested,
    limited: calc.upgraded < calc.requested,
    profile
  };
}

function upgradeRaidPower(profile, count) {
  return buyProgressiveLevels(profile, 'raid_power', WIZEBOT.RAID_POWER_MAX, count);
}

function upgradeProtection(profile, count) {
  return buyProgressiveLevels(profile, 'protection_level', WIZEBOT.PROTECTION_MAX, count);
}

module.exports = {
  RAID_POWER_MAX: WIZEBOT.RAID_POWER_MAX,
  PROTECTION_MAX: WIZEBOT.PROTECTION_MAX,
  BASE_PRICE: WIZEBOT.RAID_UPGRADE_BASE_PRICE,
  getStatus,
  upgradeRaidPower,
  upgradeProtection
};
