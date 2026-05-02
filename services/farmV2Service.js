function buildFarmV2FromProfile(profile) {
  if (!profile) return null;

  const sourceFarm = profile.farm && typeof profile.farm === 'object'
    ? JSON.parse(JSON.stringify(profile.farm))
    : {};

  const farm = sourceFarm;
  farm.resources = farm.resources || {};
  farm.buildings = farm.buildings || {};
  farm.unlocked_at = farm.unlocked_at || {};
  farm.unlocked_at_ani = farm.unlocked_at_ani || {};
  farm.raidLogs = Array.isArray(farm.raidLogs) ? farm.raidLogs : [];
  farm.lastWithdrawAt = Number(farm.lastWithdrawAt || 0);
  farm.lastRaidAt = Number(farm.lastRaidAt || 0);
  farm.raidCooldownUntil = Number(farm.raidCooldownUntil || 0);
  farm.shieldUntil = Number(farm.shieldUntil || farm.shield_until || 0);
  farm.shield_until = Number(farm.shieldUntil || farm.shield_until || 0);
  farm.savedPassive = Number(farm.savedPassive || 0);
  farm.zavodBonus = Number(farm.zavodBonus || 0);
  farm.fabrikaBonus = Number(farm.fabrikaBonus || 0);
  farm.mineBonus = Number(farm.mineBonus || 0);
  farm.level = Number(profile.level || farm.level || 0);

  return {
    version: 2,
    updated_at: Date.now(),
    source: 'website',
    login: String(profile.login || '').toLowerCase(),
    display_name: profile.display_name || profile.login || '',
    balances: {
      twitch_balance: Number(profile.twitch_balance || 0),
      farm_balance: Number(profile.farm_balance || 0),
      upgrade_balance: Number(profile.upgrade_balance || 0),
      total_income: Number(profile.total_income || 0)
    },
    progression: {
      level: Number(profile.level || farm.level || 0),
      license_level: Number(profile.license_level || 0),
      protection_level: Number(profile.protection_level || 0),
      raid_power: Number(profile.raid_power || 0),
      last_collect_at: Number(profile.last_collect_at || 0)
    },
    defense: {
      turret: profile.turret || farm.turret || {}
    },
    farm
  };
}

module.exports = { buildFarmV2FromProfile };
