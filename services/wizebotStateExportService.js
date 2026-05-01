const { getProfileByLogin } = require('./userService');

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

function toInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function cloneObject(value, fallback = {}) {
  if (!value || typeof value !== 'object') return JSON.parse(JSON.stringify(fallback));
  return JSON.parse(JSON.stringify(value));
}

function buildWizebotStateFromProfile(profile) {
  if (!profile?.login) return null;

  const login = normalizeLogin(profile.login);
  const farm = cloneObject(profile.farm, {});

  farm.level = toInt(profile.level ?? farm.level, 0);
  farm.resources = farm.resources && typeof farm.resources === 'object' ? farm.resources : {};
  farm.resources.parts = Math.max(0, toInt(profile.parts ?? farm.resources.parts, 0));
  farm.buildings = farm.buildings && typeof farm.buildings === 'object' ? farm.buildings : {};

  const turret = cloneObject(profile.turret, {});

  return {
    login,
    vars: {
      ['farm_' + login]: farm,
      ['farm_virtual_balance_' + login]: String(Math.max(0, toInt(profile.farm_balance, 0))),
      ['farm_upgrade_balance_' + login]: String(Math.max(0, toInt(profile.upgrade_balance, 0))),
      ['farm_total_income_' + login]: String(Math.max(0, toInt(profile.total_income, 0))),
      ['farm_last_' + login]: String(toInt(profile.last_collect_at, Date.now())),
      ['farm_license_' + login]: String(Math.max(0, toInt(profile.license_level, 0))),
      ['farm_protection_level_' + login]: String(Math.max(0, toInt(profile.protection_level, 0))),
      ['farm_raid_power_' + login]: String(Math.max(0, toInt(profile.raid_power, 0))),
      ['farm_defense_building_' + login]: turret
    },
    currency: Math.max(0, toInt(profile.twitch_balance, 0)),
    summary: {
      level: toInt(profile.level, 0),
      twitch_balance: Math.max(0, toInt(profile.twitch_balance, 0)),
      farm_balance: Math.max(0, toInt(profile.farm_balance, 0)),
      upgrade_balance: Math.max(0, toInt(profile.upgrade_balance, 0)),
      parts: Math.max(0, toInt(profile.parts, 0)),
      total_income: Math.max(0, toInt(profile.total_income, 0)),
      license_level: Math.max(0, toInt(profile.license_level, 0)),
      protection_level: Math.max(0, toInt(profile.protection_level, 0)),
      raid_power: Math.max(0, toInt(profile.raid_power, 0))
    }
  };
}

function getWizebotStateByLogin(login) {
  const normalized = normalizeLogin(login);
  if (!normalized) return null;
  const profile = getProfileByLogin(normalized);
  if (!profile) return null;
  return buildWizebotStateFromProfile(profile);
}

module.exports = {
  normalizeLogin,
  buildWizebotStateFromProfile,
  getWizebotStateByLogin
};
