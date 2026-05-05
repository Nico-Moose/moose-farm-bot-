const { ensureFarmShape } = require('./profileShape');
const { num } = require('./numberUtils');
const { getDb } = require('../dbService');

const SELL_PRICE = 10; // 1 part -> 10 upgrade coins
const BUY_PRICE = 20;  // 20 upgrade coins -> 1 part
const DEFAULT_STOCK = 20000;
const UNLIMITED_STOCK = true;
const MAX_QTY_INPUT = Number.MAX_SAFE_INTEGER;

const STOCK_KEY = 'global_market_parts_stock';
const SOLD_KEY = 'global_market_parts_sold_total';
const BOUGHT_KEY = 'global_market_parts_bought_total';

function readSettingNumber(key, fallback) {
  try {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key=?').get(key);
    if (!row) return fallback;
    const value = Number(row.value);
    return Number.isFinite(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeSettingNumber(key, value) {
  getDb().prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).run(key, String(Math.max(0, Math.floor(Number(value) || 0))), Date.now());
}

function ensureMarketState() {
  const market = {
    partsStock: Math.max(0, readSettingNumber(STOCK_KEY, DEFAULT_STOCK)),
    totalSold: Math.max(0, readSettingNumber(SOLD_KEY, 0)),
    totalBought: Math.max(0, readSettingNumber(BOUGHT_KEY, 0))
  };
  writeSettingNumber(STOCK_KEY, market.partsStock);
  writeSettingNumber(SOLD_KEY, market.totalSold);
  writeSettingNumber(BOUGHT_KEY, market.totalBought);
  return market;
}

function saveMarketState(market) {
  writeSettingNumber(STOCK_KEY, market.partsStock);
  writeSettingNumber(SOLD_KEY, market.totalSold);
  writeSettingNumber(BOUGHT_KEY, market.totalBought);
}

function setMarketStock(stock) {
  const market = ensureMarketState();
  market.partsStock = Math.max(0, Math.floor(Number(stock) || 0));
  saveMarketState(market);
  return getMarketState();
}

function getMarketState() {
  const market = ensureMarketState();
  return {
    sellPrice: SELL_PRICE,
    buyPrice: BUY_PRICE,
    stock: UNLIMITED_STOCK ? null : market.partsStock,
    totalSold: market.totalSold,
    totalBought: market.totalBought,
    maxQtyInput: MAX_QTY_INPUT,
    global: true,
    unlimited: UNLIMITED_STOCK
  };
}

function normalizeQty(qty) {
  qty = parseInt(qty, 10);
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty);
}

function sellParts(profile, qty) {
  ensureFarmShape(profile);
  const market = ensureMarketState();
  qty = normalizeQty(qty);

  if (qty <= 0) return { ok: false, error: 'invalid_quantity', profile, market: getMarketState() };
  if (qty > MAX_QTY_INPUT) return { ok: false, error: 'quantity_too_large', maxQty: MAX_QTY_INPUT, profile, market: getMarketState() };

  if (num(profile.parts, 0) < qty) {
    return { ok: false, error: 'not_enough_parts', needed: qty, available: num(profile.parts, 0), profile, market: getMarketState() };
  }

  const total = qty * SELL_PRICE;
  profile.parts = num(profile.parts, 0) - qty;
  profile.farm.resources.parts = profile.parts;
  profile.upgrade_balance = num(profile.upgrade_balance, 0) + total;

  market.totalSold += qty;
  market.partsStock += qty;
  saveMarketState(market);

  return { ok: true, action: 'sell', qty, totalCost: total, totalParts: qty, price: SELL_PRICE, profile, market: getMarketState() };
}

function buyParts(profile, qty) {
  ensureFarmShape(profile);
  const market = ensureMarketState();
  qty = normalizeQty(qty);

  if (qty <= 0) return { ok: false, error: 'invalid_quantity', profile, market: getMarketState() };
  if (qty > MAX_QTY_INPUT) return { ok: false, error: 'quantity_too_large', maxQty: MAX_QTY_INPUT, profile, market: getMarketState() };
  const maxByMoney = Math.floor(num(profile.upgrade_balance, 0) / BUY_PRICE);
  const maxCanBuy = UNLIMITED_STOCK ? maxByMoney : Math.min(maxByMoney, market.partsStock);
  if (maxCanBuy <= 0) {
    return { ok: false, error: maxByMoney <= 0 ? 'not_enough_upgrade_balance' : 'not_enough_market_stock', needed: BUY_PRICE, available: num(profile.upgrade_balance, 0), profile, market: getMarketState() };
  }

  const requested = qty;
  if (requested > maxCanBuy) {
    return {
      ok: false,
      error: 'not_enough_upgrade_balance',
      requested,
      maxCanBuy,
      needed: requested * BUY_PRICE,
      available: num(profile.upgrade_balance, 0),
      stock: UNLIMITED_STOCK ? null : market.partsStock,
      profile,
      market: getMarketState()
    };
  }

  const finalQty = requested;
  const total = finalQty * BUY_PRICE;

  profile.upgrade_balance = num(profile.upgrade_balance, 0) - total;
  profile.parts = num(profile.parts, 0) + finalQty;
  profile.farm.resources.parts = profile.parts;

  market.totalBought += finalQty;
  if (!UNLIMITED_STOCK) market.partsStock -= finalQty;
  saveMarketState(market);

  return { ok: true, action: 'buy', requested, qty: finalQty, totalCost: total, totalParts: finalQty, price: BUY_PRICE, limited: false, profile, market: getMarketState() };
}

module.exports = { SELL_PRICE, BUY_PRICE, DEFAULT_STOCK, MAX_QTY_INPUT, getMarketState, buyParts, sellParts, setMarketStock };
