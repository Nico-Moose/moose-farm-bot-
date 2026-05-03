const { getNicoMooseFarmData, getWizebotFarmDataByLogin } = require('./wizebotApiService');

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

function hasMeaningfulLegacyWizebotData(wizebotData) {
  const farm = wizebotData?.farm || {};
  const resources = farm.resources || {};
  const buildings = farm.buildings || {};
  const found = wizebotData?.found || {};

  if (found.farm || found.farm_balance || found.upgrade_balance || found.total_income || found.last_collect_at || found.license_level || found.protection_level || found.raid_power || found.turret) {
    return true;
  }

  if (Number(farm.level || 0) > 0) return true;
  if (Number(resources.parts || 0) > 0) return true;
  if (Object.keys(buildings).length > 0) return true;
  if (Number(wizebotData?.farm_balance || 0) !== 0) return true;
  if (Number(wizebotData?.upgrade_balance || 0) !== 0) return true;
  if (Number(wizebotData?.license_level || 0) !== 0) return true;
  if (Number(wizebotData?.protection_level || 0) !== 0) return true;
  if (Number(wizebotData?.raid_power || 0) !== 0) return true;

  return false;
}

function applyWizebotDataToProfile({ login, profile, wizebotData }) {
  const normalizedLogin = normalizeLogin(login || wizebotData?.login);
  if (!normalizedLogin) return { ok: false, error: 'missing_login' };

  profile = profile || {};
  const currentFarm = profile.farm && typeof profile.farm === 'object' ? profile.farm : {};
  const currentResources = currentFarm.resources || {};
  const farm = wizebotData.farm || {};
  const resources = farm.resources || {};

  profile.twitch_login = normalizedLogin;
  profile.login = normalizedLogin;
  if (wizebotData.display_name) profile.display_name = wizebotData.display_name;
  if (!profile.display_name) profile.display_name = normalizedLogin;

  profile.level = Number(farm.level ?? currentFarm.level ?? profile.level ?? 0);
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
    ...currentFarm,
    ...farm,
    level: Number(farm.level ?? currentFarm.level ?? profile.level ?? 0),
    resources: {
      ...currentResources,
      ...resources,
      parts: Number(resources.parts ?? currentResources.parts ?? profile.parts ?? 0)
    }
  };

  profile.turret = wizebotData.turret || profile.turret || {};
  profile.configs = wizebotData.configs || profile.configs || {};
  profile.globals = wizebotData.globals || profile.globals || {};
  profile.last_wizebot_sync_at = Date.now();

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
      raid_power: profile.raid_power,
      found: wizebotData?.found || {}
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

  if (!hasMeaningfulLegacyWizebotData(wizebotData)) {
    return {
      ok: false,
      error: `Старая ферма ${normalizedLogin} не найдена в WizeBot. Нужны legacy vars farm_/farm_virtual_balance_/farm_upgrade_balance_.`
    };
  }

  return applyWizebotDataToProfile({ login: normalizedLogin, profile, wizebotData });
}

module.exports = {
  normalizeLogin,
  applyWizebotDataToProfile,
  syncWizebotFarmToProfile
};
