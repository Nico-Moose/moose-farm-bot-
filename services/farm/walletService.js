const { num } = require('./numberUtils');
const { WIZEBOT } = require('./economyConfig');

function getWallet(profile) {
  return {
    farm_balance: num(profile.farm_balance, 0),
    twitch_balance: num(profile.twitch_balance, 0),
    upgrade_balance: num(profile.upgrade_balance, 0),
    total: num(profile.farm_balance, 0) + num(profile.twitch_balance, 0) + num(profile.upgrade_balance, 0),
    parts: num(profile.parts, 0)
  };
}

function applyWallet(profile, wallet) {
  profile.farm_balance = Math.floor(num(wallet.farm_balance, 0));
  if (Object.prototype.hasOwnProperty.call(profile, 'twitch_balance')) {
    profile.twitch_balance = Math.floor(num(wallet.twitch_balance, 0));
  }
  profile.upgrade_balance = Math.floor(num(wallet.upgrade_balance, 0));
}

function takeFrom(wallet, source, amount) {
  const take = Math.min(Math.max(0, num(wallet[source], 0)), Math.max(0, num(amount, 0)));
  wallet[source] -= take;
  return take;
}

function takeAboveBuffer(wallet, source, amount, buffer = WIZEBOT.MONEY_BUFFER) {
  const usable = Math.max(0, num(wallet[source], 0) - buffer);
  const take = Math.min(usable, Math.max(0, num(amount, 0)));
  wallet[source] -= take;
  return take;
}

function spendCoins(profile, amount, options = {}) {
  const needed = Math.floor(num(amount, 0));
  const mode = options.mode || 'farm_upgrade';
  const wallet = getWallet(profile);

  const stepsByMode = {
    // WizeBot !ап: farm above buffer -> twitch above buffer -> bonus -> farm -> twitch
    farm_upgrade: [
      ['above', 'farm_balance'],
      ['above', 'twitch_balance'],
      ['all', 'upgrade_balance'],
      ['all', 'farm_balance'],
      ['all', 'twitch_balance']
    ],
    // WizeBot building buy/upgrade: twitch above buffer -> farm above buffer -> bonus -> farm -> twitch
    building: [
      ['above', 'twitch_balance'],
      ['above', 'farm_balance'],
      ['all', 'upgrade_balance'],
      ['all', 'farm_balance'],
      ['all', 'twitch_balance']
    ],
    // Case: spend ordinary gold first, then farm balance. Bonus balance is ignored.
    case: [
      ['all', 'twitch_balance'],
      ['all', 'farm_balance']
    ],
    // WizeBot turret: twitch above buffer -> bonus -> twitch
    turret: [
      ['above', 'twitch_balance'],
      ['all', 'upgrade_balance'],
      ['all', 'twitch_balance'],
      ['all', 'farm_balance']
    ],
    // Simple site-only operations that intentionally use bonus first.
    upgrade_only: [
      ['all', 'upgrade_balance']
    ]
  };

  const steps = stepsByMode[mode] || stepsByMode.farm_upgrade;
  const availableSources = [...new Set(steps.map(([, source]) => source))];
  const available = availableSources.reduce((sum, source) => sum + num(wallet[source], 0), 0);

  if (available < needed) {
    return {
      ok: false,
      available,
      needed,
      missing: needed - available,
      spent: { farm_balance: 0, twitch_balance: 0, upgrade_balance: 0 }
    };
  }

  let remaining = needed;
  const spent = { farm_balance: 0, twitch_balance: 0, upgrade_balance: 0 };

  for (const [kind, source] of steps) {
    if (remaining <= 0) break;
    const taken = kind === 'above'
      ? takeAboveBuffer(wallet, source, remaining, WIZEBOT.MONEY_BUFFER)
      : takeFrom(wallet, source, remaining);
    spent[source] += taken;
    remaining -= taken;
  }

  if (remaining > 0) {
    return {
      ok: false,
      available,
      needed,
      missing: remaining,
      spent: { farm_balance: 0, twitch_balance: 0, upgrade_balance: 0 }
    };
  }

  applyWallet(profile, wallet);

  return {
    ok: true,
    available,
    needed,
    missing: 0,
    spent
  };
}

function refundCoins(profile, spent = {}) {
  profile.farm_balance = num(profile.farm_balance, 0) + num(spent.farm_balance, 0);
  if (Object.prototype.hasOwnProperty.call(profile, 'twitch_balance')) {
    profile.twitch_balance = num(profile.twitch_balance, 0) + num(spent.twitch_balance, 0);
  }
  profile.upgrade_balance = num(profile.upgrade_balance, 0) + num(spent.upgrade_balance, 0);
}

function spendParts(profile, amount) {
  amount = Math.floor(num(amount, 0));
  const available = num(profile.parts, 0);
  if (available < amount) {
    return { ok: false, available, needed: amount, missing: amount - available };
  }
  profile.parts = available - amount;
  profile.farm = profile.farm || {};
  profile.farm.resources = profile.farm.resources || {};
  profile.farm.resources.parts = profile.parts;
  return { ok: true, available, needed: amount, missing: 0 };
}

function addParts(profile, amount) {
  profile.parts = num(profile.parts, 0) + Math.floor(num(amount, 0));
  profile.farm = profile.farm || {};
  profile.farm.resources = profile.farm.resources || {};
  profile.farm.resources.parts = profile.parts;
}

module.exports = {
  getWallet,
  spendCoins,
  refundCoins,
  spendParts,
  addParts
};
