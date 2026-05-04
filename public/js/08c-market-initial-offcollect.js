/* Split from 08-feature-overrides.js. Logic unchanged. */
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
  box.innerHTML = `
    <div class="market-hero polished-market-hero">
      <div class="market-stat"><span>📦 Общий склад рынка</span><b>${formatNumber(stock)}🔧</b><small>один для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>1🔧 = ${formatNumber(buyPrice)}💎</b></div>
      <div class="market-stat"><span>🟢 Продать</span><b>1🔧 = ${formatNumber(sellPrice)}💎</b></div>
    </div>
    <div class="market-wallet polished-wallet">
      <span>💎 Ап-баланс: <b>${formatNumber(upgradeBalance)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="market-actions pretty-actions polished-market-actions">
      <input id="marketQty" type="number" min="1" step="1" value="${lastMarketQty}" />
      <button id="marketBuyBtn" ${!canBuyOne ? 'disabled' : ''}>🔵 Купить запчасти</button>
      <button id="marketSellBtn" ${!canSellOne ? 'disabled' : ''}>🟢 Продать запчасти</button>
    </div>
    <p class="market-hint">Склад рынка общий для всех. Покупка уменьшает общий склад, продажа пополняет общий склад.</p>
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

async function offCollect() {
  if (state?.streamOnline || state?.profile?.stream_online) {
    showMessage('⛔ Во время стрима оффсбор недоступен.');
    return;
  }
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showPrettyModal({
    title: '🌙 Оффсбор получен',
    subtitle: '50% от фермы + завод / 2',
    body: `<div class="result-mini-grid"><div><span>🌾 Монеты фермы</span><b>+${formatNumber(data.income || 0)}</b></div><div><span>🔧 Запчасти завода</span><b>+${formatNumber(data.partsIncome || 0)}</b></div><div><span>⏱ За период</span><b>${formatNumber(data.minutes || 0)} мин</b></div><div><span>📥 Ферма</span><b>${formatNumber((data.passive || 0) + (data.harvest || 0))} / 2</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}🌾${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
  await loadMe();
}

