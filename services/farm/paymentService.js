const { num } = require('./numberUtils');
const { ensureFarmShape } = require('./profileShape');

function getTotalMoney(profile) {
  ensureFarmShape(profile);
  return num(profile.farm_balance) + num(profile.upgrade_balance);
}

function spendMoney(profile, amount) {
  ensureFarmShape(profile);

  let need = num(amount);
  if (need <= 0) {
    return { ok: true, fromFarm: 0, fromUpgrade: 0, remaining: 0 };
  }

  if (getTotalMoney(profile) < need) {
    return { ok: false, error: 'not_enough_money', remaining: need - getTotalMoney(profile) };
  }

  const fromFarm = Math.min(profile.farm_balance, need);
  profile.farm_balance -= fromFarm;
  need -= fromFarm;

  const fromUpgrade = Math.min(profile.upgrade_balance, need);
  profile.upgrade_balance -= fromUpgrade;
  need -= fromUpgrade;

  return {
    ok: need <= 0,
    fromFarm,
    fromUpgrade,
    remaining: need
  };
}

function spendParts(profile, amount) {
  ensureFarmShape(profile);

  const need = num(amount);
  if (need <= 0) {
    return { ok: true, spent: 0, remaining: 0 };
  }

  if (profile.parts < need) {
    return { ok: false, error: 'not_enough_parts', remaining: need - profile.parts };
  }

  profile.parts -= need;
  profile.farm.resources.parts = profile.parts;

  return {
    ok: true,
    spent: need,
    remaining: 0
  };
}

module.exports = {
  getTotalMoney,
  spendMoney,
  spendParts
};
