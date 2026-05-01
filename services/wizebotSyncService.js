const { getNicoMooseFarmData, getWizebotFarmDataByLogin } = require('./wizebotApiService');

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

function applyWizebotDataToProfile({ login, profile, wizebotData }) {
  const normalizedLogin = normalizeLogin(login || wizebotData?.login);
  if (!normalizedLogin) return { ok: false, error: 'missing_login' };

  profile = profile || {};
  const farm = wizebotData.farm || {};
  const resources = farm.resources || {};

  profile.twitch_login = normalizedLogin;
  profile.login = normalizedLogin;
  if (wizebotData.display_name) profile.display_name = wizebotData.display_name;

  profile.level = Number(farm.level ?? profile.level ?? 0);
  profile.farm_balance = Number(wizebotData.farm_balance ?? profile.farm_balance ?? 0);
  profile.twitch_balance = Number(wizebotData.twitch_balance ?? profile.twitch_balance ?? 0);
  profile.upgrade_balance = Number(wizebotData.upgrade_balance ?? profile.upgrade_balance ?? 0);
  profile.parts = Number(resources.parts ?? wizebotData.parts ?? profile.parts ?? 0);
  profile.total_income = Number(wizebotData.total_income ?? profile.total_income ?? 0);
  profile.last_collect_at = Number(wizebotData.last_collect_at ?? profile.last_collect_at ?? 0);
  profile.license_level = Number(wizebotData.license_level ?? profile.license_level ?? 0);
  profile.protection_level = Number(wizebotData.protection_level ?? profile.protection_level ?? 0);
  profile.raid_power = Number(wizebotData.raid_power ?? profile.raid_power ?? 0);
  profile.farm = {
    ...farm,
    resources: {
      ...resources,
      parts: Number(resources.parts ?? profile.parts ?? 0)
    }
  };
  profile.turret = wizebotData.turret || profile.turret || {};
  profile.configs = wizebotData.configs || profile.configs || {};
  profile.globals = wizebotData.globals || profile.globals || {};

  return {
    ok: true,
    profile,
    imported: {
      login: normalizedLogin,
      level: profile.level,
      farm_balance: profile.farm_balance,
      twitch_balance: profile.twitch_balance,
      upgrade_balance: profile.upgrade_balance,
      parts: profile.parts,
      license_level: profile.license_level,
      protection_level: profile.protection_level,
      raid_power: profile.raid_power
    }
  };
}

async function syncWizebotFarmToProfile({ login, profile, allowAnyLogin = false }) {
  const normalizedLogin = normalizeLogin(login);
  if (!normalizedLogin) return { ok: false, error: 'missing_login' };

  let wizebotData;
  if (!allowAnyLogin && normalizedLogin === 'nico_moose') {
    wizebotData = await getNicoMooseFarmData();
  } else {
    wizebotData = await getWizebotFarmDataByLogin(normalizedLogin, {
      currentTwitchBalance: profile?.twitch_balance ?? 0,
      currentFarmBalance: profile?.farm_balance ?? 0,
      currentUpgradeBalance: profile?.upgrade_balance ?? 0,
      currentTotalIncome: profile?.total_income ?? 0,
      currentLastCollectAt: profile?.last_collect_at ?? 0,
      currentLicenseLevel: profile?.license_level ?? 0,
      currentProtectionLevel: profile?.protection_level ?? 0,
      currentRaidPower: profile?.raid_power ?? 0,
      currentTurret: profile?.turret || {},
      currentConfigs: profile?.configs || {},
      currentGlobals: profile?.globals || {}
    });
  }

  return applyWizebotDataToProfile({ login: normalizedLogin, profile, wizebotData });
}

module.exports = {
  normalizeLogin,
  applyWizebotDataToProfile,
  syncWizebotFarmToProfile
};
