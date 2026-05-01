const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');

const RAID_POWER_MAX = 200;
const PROTECTION_MAX = 120;
const BASE_PRICE = 400000;

function getStatus(profile) {
  ensureFarmShape(profile);
  const raidPower = num(profile.raid_power, 0);
  const protectionLevel = num(profile.protection_level, 0);
  return {
    raidPower: {
      level: raidPower,
      maxLevel: RAID_POWER_MAX,
      nextCost: raidPower >= RAID_POWER_MAX ? null : BASE_PRICE * (raidPower + 1),
      available: num(profile.upgrade_balance, 0),
      unlocked: num(profile.level, 0) >= 120
    },
    protection: {
      level: protectionLevel,
      maxLevel: PROTECTION_MAX,
      percent: protectionLevel * 0.5,
      nextCost: protectionLevel >= PROTECTION_MAX ? null : BASE_PRICE * (protectionLevel + 1),
      available: num(profile.upgrade_balance, 0),
      unlocked: num(profile.level, 0) >= 120
    }
  };
}

function buyProgressiveLevels(profile, field, maxLevel, requestedCount) {
  ensureFarmShape(profile);
  requestedCount = Math.max(1, Math.min(parseInt(requestedCount, 10) || 1, 200));

  if (num(profile.level, 0) < 120) {
    return { ok: false, error: 'farm_level_too_low', requiredLevel: 120, profile };
  }

  const current = num(profile[field], 0);
  if (current >= maxLevel) {
    return { ok: false, error: 'max_level', profile };
  }

  requestedCount = Math.min(requestedCount, maxLevel - current);

  let totalCost = 0;
  let affordableCount = 0;
  const available = num(profile.upgrade_balance, 0);

  for (let i = 0; i < requestedCount; i++) {
    const levelPrice = BASE_PRICE * (current + 1 + i);
    if (available >= totalCost + levelPrice) {
      totalCost += levelPrice;
      affordableCount++;
    } else {
      break;
    }
  }

  if (affordableCount <= 0) {
    return {
      ok: false,
      error: 'not_enough_upgrade_balance',
      needed: BASE_PRICE * (current + 1),
      available,
      profile
    };
  }

  profile.upgrade_balance = available - totalCost;
  profile[field] = current + affordableCount;

  return {
    ok: true,
    upgraded: affordableCount,
    level: profile[field],
    totalCost,
    requested: requestedCount,
    limited: affordableCount < requestedCount,
    profile
  };
}

function upgradeRaidPower(profile, count) {
  return buyProgressiveLevels(profile, 'raid_power', RAID_POWER_MAX, count);
}

function upgradeProtection(profile, count) {
  return buyProgressiveLevels(profile, 'protection_level', PROTECTION_MAX, count);
}

module.exports = {
  RAID_POWER_MAX,
  PROTECTION_MAX,
  BASE_PRICE,
  getStatus,
  upgradeRaidPower,
  upgradeProtection
};
