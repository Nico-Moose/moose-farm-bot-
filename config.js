const ALLOWED_LOGIN = 'nico_moose';

function isAllowedLogin(login) {
  return String(login || '').trim().toLowerCase() === ALLOWED_LOGIN;
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function applyWizeBotBridgePayload(profile, payload) {
  const login = String(payload.login || payload.user || '').trim().toLowerCase();

  if (!isAllowedLogin(login)) {
    return {
      ok: false,
      error: 'sync_allowed_only_for_nico_moose',
    };
  }

  const farm = parseJsonValue(payload.farm, {});
  const resources = farm.resources || {};
  const buildings = farm.buildings || {};

  profile.level = toInt(farm.level, profile.level || 0);
  profile.farm_balance = toInt(payload.farm_balance, profile.farm_balance || 0);
  profile.upgrade_balance = toInt(payload.upgrade_balance, profile.upgrade_balance || 0);
  profile.total_income = toInt(payload.total_income, profile.total_income || 0);
  profile.parts = toInt(resources.parts, profile.parts || 0);
  profile.last_collect_at = toInt(payload.last_collect_at, profile.last_collect_at || null);

  profile.license_level = toInt(payload.license_level, profile.license_level || 0);
  profile.protection_level = toInt(payload.protection_level, profile.protection_level || 0);
  profile.raid_power = toInt(payload.raid_power, profile.raid_power || 0);

  profile.farm_json = JSON.stringify(farm);
  profile.resources_json = JSON.stringify(resources);
  profile.buildings_json = JSON.stringify(buildings);
  profile.turret_json = JSON.stringify(parseJsonValue(payload.turret, {}));
  profile.synced_from_wizebot_at = Date.now();

  return {
    ok: true,
    profile,
    imported: {
      login,
      level: profile.level,
      farm_balance: profile.farm_balance,
      upgrade_balance: profile.upgrade_balance,
      total_income: profile.total_income,
      parts: profile.parts,
      buildings,
      license_level: profile.license_level,
      protection_level: profile.protection_level,
      raid_power: profile.raid_power,
    },
  };
}

module.exports = {
  ALLOWED_LOGIN,
  isAllowedLogin,
  applyWizeBotBridgePayload,
};
