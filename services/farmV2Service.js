function buildFarmV2FromProfile(profile) {
  if (!profile) return null;

  const farm = profile.farm || {};
  const resources = farm.resources || {};
  const buildings = farm.buildings || {};
  const unlockedAt = farm.unlocked_at || {};
  const unlockedAtAni = farm.unlocked_at_ani || {};
  const raidLogs = Array.isArray(farm.raidLogs) ? farm.raidLogs : [];

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
    farm: {
      savedPassive: Number(farm.savedPassive || 0),
      resources,
      unlocked_at: unlockedAt,
      unlocked_at_ani: unlockedAtAni,
      buildings,
      zavodBonus: Number(farm.zavodBonus || 0),
      fabrikaBonus: Number(farm.fabrikaBonus || 0),
      mineBonus: Number(farm.mineBonus || 0),
      lastWithdrawAt: Number(farm.lastWithdrawAt || 0),
      lastRaidAt: Number(farm.lastRaidAt || 0),
      raidCooldownUntil: Number(farm.raidCooldownUntil || 0),
      shieldUntil: Number(farm.shieldUntil || farm.shield_until || 0),
      shield_until: Number(farm.shieldUntil || farm.shield_until || 0),
      raidLogs
    }
  };
}

module.exports = { buildFarmV2FromProfile };
