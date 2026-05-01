const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');

const SELL_PRICE = 10; // 1 part -> 10 upgrade coins
const BUY_PRICE = 20;  // 20 upgrade coins -> 1 part
const DEFAULT_STOCK = 20000;
const MAX_QTY_INPUT = 2000000;

function ensureMarketState(profile) {
  ensureFarmShape(profile);
  profile.farm.market = profile.farm.market || {};

  if (!Number.isFinite(Number(profile.farm.market.partsStock))) {
    profile.farm.market.partsStock = DEFAULT_STOCK;
  }
  if (!Number.isFinite(Number(profile.farm.market.totalSold))) {
    profile.farm.market.totalSold = 0;
  }
  if (!Number.isFinite(Number(profile.farm.market.totalBought))) {
    profile.farm.market.totalBought = 0;
  }

  profile.farm.market.partsStock = Math.max(0, num(profile.farm.market.partsStock, DEFAULT_STOCK));
  profile.farm.market.totalSold = Math.max(0, num(profile.farm.market.totalSold, 0));
  profile.farm.market.totalBought = Math.max(0, num(profile.farm.market.totalBought, 0));

  return profile.farm.market;
}

function getMarketState(profile) {
  const market = ensureMarketState(profile);

  return {
    sellPrice: SELL_PRICE,
    buyPrice: BUY_PRICE,
    stock: market.partsStock,
    totalSold: market.totalSold,
    totalBought: market.totalBought,
    maxQtyInput: MAX_QTY_INPUT
  };
}

function normalizeQty(qty) {
  qty = parseInt(qty, 10);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty);
}

function sellParts(profile, qty) {
  const market = ensureMarketState(profile);
  qty = normalizeQty(qty);

  if (qty <= 0) {
    return { ok: false, error: 'invalid_quantity', profile, market: getMarketState(profile) };
  }

  if (qty > MAX_QTY_INPUT) {
    return { ok: false, error: 'quantity_too_large', maxQty: MAX_QTY_INPUT, profile, market: getMarketState(profile) };
  }

  if (num(profile.parts, 0) < qty) {
    return {
      ok: false,
      error: 'not_enough_parts',
      needed: qty,
      available: num(profile.parts, 0),
      profile,
      market: getMarketState(profile)
    };
  }

  const total = qty * SELL_PRICE;

  profile.parts = num(profile.parts, 0) - qty;
  profile.farm.resources.parts = profile.parts;
  profile.upgrade_balance = num(profile.upgrade_balance, 0) + total;

  market.totalSold += qty;
  market.partsStock += qty;

  return {
    ok: true,
    action: 'sell',
    qty,
    totalCost: total,
    totalParts: qty,
    price: SELL_PRICE,
    profile,
    market: getMarketState(profile)
  };
}

function buyParts(profile, qty) {
  const market = ensureMarketState(profile);
  qty = normalizeQty(qty);

  if (qty <= 0) {
    return { ok: false, error: 'invalid_quantity', profile, market: getMarketState(profile) };
  }

  if (qty > MAX_QTY_INPUT) {
    return { ok: false, error: 'quantity_too_large', maxQty: MAX_QTY_INPUT, profile, market: getMarketState(profile) };
  }

  if (market.partsStock <= 0) {
    return { ok: false, error: 'market_stock_empty', profile, market: getMarketState(profile) };
  }

  const maxByMoney = Math.floor(num(profile.upgrade_balance, 0) / BUY_PRICE);
  const maxCanBuy = Math.min(maxByMoney, market.partsStock);

  if (maxCanBuy <= 0) {
    return {
      ok: false,
      error: maxByMoney <= 0 ? 'not_enough_upgrade_balance' : 'not_enough_market_stock',
      needed: BUY_PRICE,
      available: num(profile.upgrade_balance, 0),
      profile,
      market: getMarketState(profile)
    };
  }

  const requested = qty;
  const finalQty = Math.min(qty, maxCanBuy);
  const total = finalQty * BUY_PRICE;

  profile.upgrade_balance = num(profile.upgrade_balance, 0) - total;
  profile.parts = num(profile.parts, 0) + finalQty;
  profile.farm.resources.parts = profile.parts;

  market.totalBought += finalQty;
  market.partsStock -= finalQty;

  return {
    ok: true,
    action: 'buy',
    requested,
    qty: finalQty,
    totalCost: total,
    totalParts: finalQty,
    price: BUY_PRICE,
    limited: finalQty < requested,
    profile,
    market: getMarketState(profile)
  };
}

module.exports = {
  SELL_PRICE,
  BUY_PRICE,
  DEFAULT_STOCK,
  MAX_QTY_INPUT,
  getMarketState,
  buyParts,
  sellParts
};
