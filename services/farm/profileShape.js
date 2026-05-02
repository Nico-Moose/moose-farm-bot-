const { num } = require('./numberUtils');

function ensureFarmShape(profile) {
  profile.level = num(profile.level);
  profile.farm_balance = num(profile.farm_balance);
  profile.upgrade_balance = num(profile.upgrade_balance);
  profile.total_income = num(profile.total_income);
  profile.parts = num(profile.parts);
  profile.license_level = num(profile.license_level);
  profile.protection_level = num(profile.protection_level);
  profile.raid_power = num(profile.raid_power);

  profile.farm = profile.farm || {};
  profile.farm.resources = profile.farm.resources || {};
  profile.farm.buildings = profile.farm.buildings || {};

  profile.farm.level = profile.level;

  const farmParts = num(profile.farm.resources.parts, 0);
  if (profile.parts <= 0 && farmParts > 0) {
    profile.parts = farmParts;
  }
  profile.farm.resources.parts = profile.parts;

  profile.configs = profile.configs || {};
  profile.configs.plants = profile.configs.plants || [];
  profile.configs.animals = profile.configs.animals || [];
  profile.configs.buildings = profile.configs.buildings || {};
  profile.configs.licenses = profile.configs.licenses || {};
  profile.configs.parts_required = profile.configs.parts_required || {};
  profile.configs.turret_upgrades = profile.configs.turret_upgrades || [];

  profile.turret = profile.turret || {};

 profile.farm.caseHistory = Array.isArray(profile.farm.caseHistory) ? profile.farm.caseHistory : [];
profile.farm.caseStats = profile.farm.caseStats && typeof profile.farm.caseStats === 'object'
  ? {
      opened: num(profile.farm.caseStats.opened, 0),
      spent: num(profile.farm.caseStats.spent, 0),
      coins: num(profile.farm.caseStats.coins, 0),
      parts: num(profile.farm.caseStats.parts, 0)
    }
  : { opened: 0, spent: 0, coins: 0, parts: 0 };

profile.farm.lastCaseAt = num(profile.farm.lastCaseAt, 0);
profile.farm.caseCooldownUntil = num(profile.farm.caseCooldownUntil, 0);

profile.farm.raidLogs = Array.isArray(profile.farm.raidLogs) ? profile.farm.raidLogs : [];
profile.farm.resources.shield = num(profile.farm.resources.shield, 0);
profile.farm.resources.weapon = num(profile.farm.resources.weapon, 0);

  return profile;
}

module.exports = {
  ensureFarmShape
};
