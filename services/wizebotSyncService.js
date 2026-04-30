const { getNicoMooseFarmData } = require('./wizebotApiService');

const ALLOWED_LOGIN = 'nico_moose';

function assertAllowedUser(login) {
  return String(login || '').toLowerCase() === ALLOWED_LOGIN;
}

function applyWizebotDataToProfile({ login, profile, wizebotData }) {
  if (!assertAllowedUser(login)) {
    return {
      ok: false,
      error: 'sync_allowed_only_for_nico_moose'
    };
  }

  const oldFarm = wizebotData.farm || {};
  const resources = oldFarm.resources || {};

  profile.level = Number(oldFarm.level ?? profile.level ?? 0);
  profile.farm_balance = Number(wizebotData.farm_balance ?? profile.farm_balance ?? 0);
  profile.upgrade_balance = Number(wizebotData.upgrade_balance ?? profile.upgrade_balance ?? 0);
  profile.parts = Number(resources.parts ?? profile.parts ?? 0);

  return {
    ok: true,
    profile,
    imported: {
      level: profile.level,
      farm_balance: profile.farm_balance,
      upgrade_balance: profile.upgrade_balance,
      parts: profile.parts
    }
  };
}

async function syncWizebotFarmToProfile({ login, profile }) {
  if (!assertAllowedUser(login)) {
    return {
      ok: false,
      error: 'sync_allowed_only_for_nico_moose'
    };
  }

  const wizebotData = await getNicoMooseFarmData();

  return applyWizebotDataToProfile({
    login,
    profile,
    wizebotData
  });
}

module.exports = {
  ALLOWED_LOGIN,
  assertAllowedUser,
  applyWizebotDataToProfile,
  syncWizebotFarmToProfile
};
