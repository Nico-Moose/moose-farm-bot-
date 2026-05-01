const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { spendCoins } = require('./paymentService');

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

  const paid = spendCoins(profile, next.cost);

  if (!paid.ok) {
    return {
      ok: false,
      error: 'not_enough_money',
      needed: next.cost,
      available: paid.available,
      profile
    };
  }

  profile.license_level = next.level;

  return {
    ok: true,
    licenseLevel: next.level,
    cost: next.cost,
    spent: paid.spent,
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
