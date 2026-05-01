const { getNicoMooseFarmData } = require('./wizebotApiService');

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase();
}

function applyWizebotDataToProfile({ login, profile, wizebotData }) {
  const normalizedLogin = normalizeLogin(login || wizebotData?.login);

  if (!normalizedLogin) {
    return {
      ok: false,
      error: 'missing_login'
    };
  }

  if (!profile) {
    profile = {};
  }

  const farm = wizebotData.farm || {};
  const resources = farm.resources || {};

  profile.twitch_login = normalizedLogin;
  profile.login = normalizedLogin;

  profile.level = Number(farm.level ?? profile.level ?? 0);
  profile.farm_balance = Number(wizebotData.farm_balance ?? profile.farm_balance ?? 0);
  profile.upgrade_balance = Number(wizebotData.upgrade_balance ?? profile.upgrade_balance ?? 0);
  profile.parts = Number(resources.parts ?? wizebotData.parts ?? profile.parts ?? 0);

  profile.total_income = Number(wizebotData.total_income ?? profile.total_income ?? 0);
  profile.last_collect_at = Number(wizebotData.last_collect_at ?? profile.last_collect_at ?? 0);

  profile.license_level = Number(wizebotData.license_level ?? profile.license_level ?? 0);
  profile.protection_level = Number(wizebotData.protection_level ?? profile.protection_level ?? 0);
  profile.raid_power = Number(wizebotData.raid_power ?? profile.raid_power ?? 0);

  profile.farm_json = JSON.stringify({
    ...farm,
    resources: {
      ...resources,
      parts: Number(resources.parts ?? profile.parts ?? 0)
    }
  });

  profile.configs = JSON.stringify(wizebotData.configs || {});
  profile.turret_json = JSON.stringify(wizebotData.turret || {});
  profile.globals_json = JSON.stringify(wizebotData.globals || {});

  return {
    ok: true,
    profile,
    imported: {
      login: normalizedLogin,
      level: profile.level,
      farm_balance: profile.farm_balance,
      upgrade_balance: profile.upgrade_balance,
      parts: profile.parts,
      license_level: profile.license_level,
      protection_level: profile.protection_level,
      raid_power: profile.raid_power
    }
  };
}

// Этот метод оставляем для старого ручного API-sync Nico_Moose.
// Для sync через чат MOOSE_SYNC используется applyWizebotDataToProfile.
async function syncWizebotFarmToProfile({ login, profile }) {
  const normalizedLogin = normalizeLogin(login);

  if (normalizedLogin !== 'nico_moose') {
    return {
      ok: false,
      error: 'direct_api_sync_only_for_nico_moose_use_moose_sync_longtext'
    };
  }

  const wizebotData = await getNicoMooseFarmData();

  return applyWizebotDataToProfile({
    login: normalizedLogin,
    profile,
    wizebotData
  });
}

module.exports = {
  normalizeLogin,
  applyWizebotDataToProfile,
  syncWizebotFarmToProfile
};
