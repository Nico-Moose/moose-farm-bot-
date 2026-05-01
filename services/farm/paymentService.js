const { num } = require('./numberUtils');

function getBalances(profile) {
  return {
    farm_balance: num(profile.farm_balance, 0),
    upgrade_balance: num(profile.upgrade_balance, 0),
    parts: num(profile.parts, 0)
  };
}

function spendCoins(profile, amount) {
  amount = num(amount, 0);

  const available = num(profile.farm_balance, 0) + num(profile.upgrade_balance, 0);

  if (available < amount) {
    return {
      ok: false,
      available,
      needed: amount,
      spent: {
        farm_balance: 0,
        upgrade_balance: 0
      }
    };
  }

  let need = amount;

  const fromFarm = Math.min(num(profile.farm_balance, 0), need);
  profile.farm_balance = num(profile.farm_balance, 0) - fromFarm;
  need -= fromFarm;

  const fromUpgrade = Math.min(num(profile.upgrade_balance, 0), need);
  profile.upgrade_balance = num(profile.upgrade_balance, 0) - fromUpgrade;
  need -= fromUpgrade;

  return {
    ok: true,
    available,
    needed: amount,
    spent: {
      farm_balance: fromFarm,
      upgrade_balance: fromUpgrade
    }
  };
}

function spendParts(profile, amount) {
  amount = num(amount, 0);

  if (num(profile.parts, 0) < amount) {
    return {
      ok: false,
      available: num(profile.parts, 0),
      needed: amount
    };
  }

  profile.parts = num(profile.parts, 0) - amount;

  if (profile.farm?.resources) {
    profile.farm.resources.parts = Math.max(0, num(profile.farm.resources.parts, 0) - amount);
  }

  return {
    ok: true,
    needed: amount
  };
}

module.exports = {
  getBalances,
  spendCoins,
  spendParts
};
