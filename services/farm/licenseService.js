const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');

function getLicenseLevels(profile) {
  const licenses = profile?.configs?.licenses || {};
  return Object.keys(licenses)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function getCurrentLicenseLevel(profile) {
  return num(profile?.license_level, 0);
}

function getDisplayLicenseLevel(profile) {
  const current = getCurrentLicenseLevel(profile);
  return current === 0 ? 39 : current;
}

function getNextLicense(profile) {
  ensureFarmShape(profile);

  const licenses = profile.configs?.licenses || {};
  const current = getCurrentLicenseLevel(profile);
  const levels = getLicenseLevels(profile);

  const nextLevel = levels.find((level) => level > current);

  if (!nextLevel) {
    return null;
  }

  return {
    level: nextLevel,
    cost: num(licenses[String(nextLevel)] ?? licenses[nextLevel], 0),
    current,
    displayUnlockedTo: getDisplayLicenseLevel(profile)
  };
}

function buyNextLicense(profile) {
  ensureFarmShape(profile);

  const next = getNextLicense(profile);

  if (!next) {
    return {
      ok: false,
      error: 'all_licenses_bought',
      profile
    };
  }

  if (next.cost <= 0) {
    return {
      ok: false,
      error: 'license_config_invalid',
      profile
    };
  }

  const currentGold = num(profile?.twitch_balance, 0);
  if (currentGold < next.cost) {
    return {
      ok: false,
      error: 'not_enough_money',
      needed: next.cost,
      available: currentGold,
      profile
    };
  }

  profile.twitch_balance = currentGold - next.cost;
  profile.license_level = next.level;

  return {
    ok: true,
    licenseLevel: next.level,
    cost: next.cost,
    spent: { farm_balance: 0, twitch_balance: next.cost, upgrade_balance: 0 },
    profile
  };
}

module.exports = {
  getLicenseLevels,
  getCurrentLicenseLevel,
  getDisplayLicenseLevel,
  getNextLicense,
  buyNextLicense
};
