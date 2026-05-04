/* Moose Farm frontend split module: рынок: базовый рендер
   Safe-refactor: extracted from public/app.js without logic changes. */
function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;

  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const canBuyOne = stock > 0 && upgradeBalance >= buyPrice;
  const canSellOne = parts > 0;
  const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));

  box.innerHTML = `
    <div class="market-hero">
      <div class="market-stat"><span>📦 Склад</span><b>${formatNumber(stock)}🔧</b></div>
      <div class="market-stat"><span>🔵 Купить</span><b>1🔧 = ${formatNumber(buyPrice)}💎</b></div>
      <div class="market-stat"><span>🟢 Продать</span><b>1🔧 = ${formatNumber(sellPrice)}💎</b></div>
      <div class="market-stat"><span>Твой лимит покупки</span><b>${formatNumber(maxBuy)}🔧</b></div>
    </div>
    <div class="market-wallet">
      <span>💎 Ап-баланс: <b>${formatNumber(upgradeBalance)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="market-actions pretty-actions">
      <input id="marketQty" type="number" min="1" step="1" value="${lastMarketQty}" />
      <button id="marketBuyBtn" ${!canBuyOne ? 'disabled' : ''}>🔵 Купить запчасти</button>
      <button id="marketSellBtn" ${!canSellOne ? 'disabled' : ''}>🟢 Продать запчасти</button>
    </div>
    <p class="market-hint">${canBuyOne ? 'Покупка списывает 💎 и выдаёт 🔧.' : 'Для покупки нужны 💎 и склад рынка.'} ${canSellOne ? 'Продажа выдаёт 💎.' : 'Для продажи нужны 🔧.'}</p>
  `;

  const qtyInput = document.getElementById('marketQty');
  qtyInput?.addEventListener('input', () => {
    const value = Math.max(1, Number(qtyInput.value || 1));
    lastMarketQty = value;
    localStorage.setItem('mooseFarmLastMarketQty', String(value));
  });
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}
