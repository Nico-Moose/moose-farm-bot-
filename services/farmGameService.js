const { ensureFarmShape } = require('./farm/profileShape');
const { num } = require('./farm/numberUtils');
const {
  MAX_LEVEL,
  MAX_UPGRADE_PER_CLICK,
  calcUpgradeCost,
  getPartsRequired,
  getLicenseCost,
  isLicenseRequired,
  getNextUpgrade,
  upgradeFarm
} = require('./farm/upgradeService');
const { COLLECT_COOLDOWN_MS, collectFarm } = require('./farm/collectService');
const { listBuildings, buyBuilding, upgradeBuilding } = require('./farm/buildingService');

function addTestBalance(profile, amount = 100000) {
  ensureFarmShape(profile);

  profile.farm_balance += num(amount, 100000);

  return {
    ok: true,
    amount: num(amount, 100000),
    profile
  };
}

module.exports = {
  MAX_LEVEL,
  MAX_UPGRADE_PER_CLICK,
  COLLECT_COOLDOWN_MS,
  calcUpgradeCost,
  getPartsRequired,
  getLicenseCost,
  isLicenseRequired,
  getNextUpgrade,
  upgradeFarm,
  collectFarm,
  addTestBalance,
  listBuildings,
  buyBuilding,
  upgradeBuilding
};
