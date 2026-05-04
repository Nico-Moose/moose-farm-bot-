/* Extracted from 10-final-patches.js lines 2181-2615. Safe split, logic unchanged. */
/* ============================================================================
   SAFE PATCH 2026-05-04: market qty buttons exact big-number math v2
   - restores visible +/- buttons after the previous override
   - no 2kk UI limit
   - keeps exact integer value for 10kk/100kk/1b+ so small +/- steps work
   ========================================================================== */
(function(){
  if (window.__mooseMarketExactQtyButtonsV2) return;
  window.__mooseMarketExactQtyButtonsV2 = true;

  const MARKET_STEPS = [
    { label: '1к', value: 1000 },
    { label: '10к', value: 10000 },
    { label: '100к', value: 100000 },
    { label: '1кк', value: 1000000 }
  ];

  function mqParse(value) {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/,/g, '.');
    if (!raw) return 0;

    const m = raw.match(/^(-?\d+(?:\.\d+)?)(млрд|миллиард(?:а|ов)?|b|bn|кк|kk|м|m|к|k)?$/i);
    if (!m) return Math.max(0, Math.floor(Number(raw.replace(/[^0-9.-]/g, '')) || 0));

    const n = Number(m[1] || 0);
    const suffix = String(m[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'к' || suffix === 'k') mult = 1_000;
    else if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') mult = 1_000_000;
    else if (suffix === 'млрд' || suffix === 'b' || suffix === 'bn' || suffix.startsWith('миллиард')) mult = 1_000_000_000;

    return Math.max(0, Math.floor(n * mult));
  }

  function trimFixed(value, digits) {
    return Number(value.toFixed(digits)).toString();
  }

  function mqInputText(value) {
    const n = Math.max(0, Math.floor(Number(value || 0)));
    // В поле рынка всегда показываем точное число, без сокращений "1к/1кк/1млрд".
    // Так маленькие шаги +/- остаются понятными на больших суммах: 1 070 700, 12 001 000, 1 000 010 000.
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function mqPretty(value) {
    if (typeof stageFormat === 'function') {
      try { return stageFormat(value); } catch (_) {}
    }
    return mqInputText(value);
  }

  function mqGet(input) {
    if (!input) return 0;
    const stored = Number(input.dataset.exactQty || 0);
    const parsed = mqParse(input.value);
    const value = input.dataset.exactQty && input.value.trim() === input.dataset.prettyQty ? stored : parsed;
    const safe = Math.max(0, Math.floor(Number(value || 0)));
    input.dataset.exactQty = String(safe);
    input.dataset.numericValue = String(safe);
    return safe;
  }

  function mqSet(input, value) {
    if (!input) return;
    const safe = Math.max(0, Math.floor(Number(value || 0)));
    const pretty = mqInputText(safe);
    input.dataset.exactQty = String(safe);
    input.dataset.numericValue = String(safe);
    input.dataset.prettyQty = pretty;
    input.value = pretty;
    try {
      lastMarketQty = safe;
      localStorage.setItem('mooseFarmLastMarketQty', String(safe));
    } catch (_) {}
    mqCalc();
  }

  function mqStateData() {
    return state || window.state || {};
  }

  function mqCalc() {
    const input = document.getElementById('marketQty');
    const calc = document.getElementById('marketCalc');
    if (!input || !calc) return;

    const data = mqStateData();
    const market = data.market || {};
    const profile = data.profile || {};
    const q = mqGet(input);
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const stock = Math.max(0, Number(market.stock || 0));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    const canBuy = q > 0 && q <= maxBuy;
    const canSell = q > 0 && q <= parts;

    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.disabled = !canBuy;
    if (sellBtn) sellBtn.disabled = !canSell;

    calc.innerHTML = `Калькулятор: купить <b>${mqPretty(q)}🔧</b> = <b>${mqPretty(q * buyPrice)}💎</b> · продать <b>${mqPretty(q)}🔧</b> = <b>${mqPretty(q * sellPrice)}💎</b>`;
  }

  function mqMax(type) {
    const data = mqStateData();
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    if (type === 'buy') return Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    return Math.max(0, parts);
  }

  function mqInstallMarketButtons() {
    const box = document.getElementById('marketBox');
    const input = document.getElementById('marketQty');
    if (!box || !input) return;

    const actions = box.querySelector('.market-actions') || input.parentElement;
    if (!actions) return;

    box.querySelectorAll('.market-preset-row, .market-preset-row-minus, .market-preset-row-plus').forEach((row) => row.remove());

    const plusRow = document.createElement('div');
    plusRow.className = 'market-preset-row market-preset-row-fixed market-preset-grid market-preset-row-plus';
    plusRow.innerHTML = MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="${s.value}">+${s.label}</button>`).join('') +
      '<button type="button" class="market-preset-btn-eq" data-market-max="buy">макс купить</button>' +
      '<button type="button" class="market-preset-btn-eq" data-market-max="sell">макс продать</button>';

    const minusRow = document.createElement('div');
    minusRow.className = 'market-preset-row market-preset-row-minus market-preset-grid';
    minusRow.innerHTML = MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="-${s.value}">-${s.label}</button>`).join('') +
      '<button type="button" class="market-preset-btn-eq" data-market-reset="1">0</button>';

    actions.parentNode.insertBefore(plusRow, actions);
    actions.parentNode.insertBefore(minusRow, actions);

    const current = mqParse(input.dataset.exactQty || input.dataset.numericValue || input.value || lastMarketQty || 1000);
    mqSet(input, current || 1000);

    input.setAttribute('inputmode', 'text');
    input.setAttribute('autocomplete', 'off');
    input.oninput = () => {
      const exact = mqParse(input.value);
      input.dataset.exactQty = String(exact);
      input.dataset.numericValue = String(exact);
      input.dataset.prettyQty = input.value;
      try {
        lastMarketQty = exact;
        localStorage.setItem('mooseFarmLastMarketQty', String(exact));
      } catch (_) {}
      mqCalc();
    };
    input.onblur = () => mqSet(input, mqGet(input));
    input.onchange = () => mqSet(input, mqGet(input));

    box.querySelectorAll('[data-market-delta]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const delta = Number(btn.getAttribute('data-market-delta') || 0);
        mqSet(input, mqGet(input) + delta);
      };
    });

    box.querySelectorAll('[data-market-max]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        mqSet(input, mqMax(String(btn.getAttribute('data-market-max') || 'sell')));
      };
    });

    box.querySelectorAll('[data-market-reset]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        mqSet(input, 0);
      };
    });

    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.onclick = (e) => { e.preventDefault(); mqSet(input, mqGet(input)); marketTrade('buy'); };
    if (sellBtn) sellBtn.onclick = (e) => { e.preventDefault(); mqSet(input, mqGet(input)); marketTrade('sell'); };
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket) {
    renderMarket = function patchedRenderMarketExactQtyButtonsV2(data) {
      oldRenderMarket(data);
      try { mqInstallMarketButtons(); } catch (e) { console.warn('[MARKET QTY BUTTONS V2]', e); }
    };
  }

  const oldMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (oldMarketTrade) {
    marketTrade = async function patchedMarketTradeExactQtyV2(action) {
      const input = document.getElementById('marketQty');
      const qty = mqGet(input);
      if (input) input.value = String(qty);
      try {
        return await oldMarketTrade(action);
      } finally {
        if (input) mqSet(input, qty);
      }
    };
  }
})();

/* ============================================================================
   SAFE PATCH 2026-05-04: market exact full-number UI final
   - market uses the same "Текущие ресурсы" block as buildings
   - removes old compact balance/parts strip from market render
   - keeps qty, calculator, toast and local market history as exact spaced numbers
   - does not abbreviate market trade quantities to к/кк/млрд
   ========================================================================== */
(function(){
  if (window.__mooseMarketFullExactFinal) return;
  window.__mooseMarketFullExactFinal = true;

  const MARKET_STEPS = [
    { label: '1к', value: 1000 },
    { label: '10к', value: 10000 },
    { label: '100к', value: 100000 },
    { label: '1кк', value: 1000000 }
  ];

  function marketExact(n) {
    const value = Math.max(0, Math.floor(Number(n || 0)));
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function marketParse(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(млрд|миллиард(?:а|ов)?|b|bn|кк|kk|м|m|к|k)?$/i);
    if (!m) return Math.max(0, Math.floor(Number(raw.replace(/[^0-9.-]/g, '')) || 0));
    const n = Number(m[1] || 0);
    const suffix = String(m[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'к' || suffix === 'k') mult = 1000;
    else if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') mult = 1000000;
    else if (suffix === 'млрд' || suffix === 'b' || suffix === 'bn' || suffix.startsWith('миллиард')) mult = 1000000000;
    return Math.max(0, Math.floor(n * mult));
  }

  function marketSetInput(input, value, recalc = true) {
    if (!input) return;
    const exact = Math.max(0, Math.floor(Number(value || 0)));
    input.dataset.exactQty = String(exact);
    input.dataset.numericValue = String(exact);
    input.dataset.prettyQty = marketExact(exact);
    input.value = marketExact(exact);
    try {
      lastMarketQty = exact;
      localStorage.setItem('mooseFarmLastMarketQty', String(exact));
    } catch (_) {}
    if (recalc) marketRecalc();
  }

  function marketGetInput(input) {
    if (!input) return 0;
    const exact = marketParse(input.value);
    input.dataset.exactQty = String(exact);
    input.dataset.numericValue = String(exact);
    return exact;
  }

  function marketData() {
    return state || window.state || {};
  }

  function marketMax(type) {
    const data = marketData();
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || profile.upgradeBalance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    return type === 'buy' ? Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice))) : parts;
  }

  function marketRecalc() {
    const input = document.getElementById('marketQty');
    const calc = document.getElementById('marketCalc');
    if (!input || !calc) return;
    const data = marketData();
    const market = data.market || {};
    const profile = data.profile || {};
    const q = marketGetInput(input);
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const stock = Math.max(0, Number(market.stock || 0));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || profile.upgradeBalance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.disabled = !(q > 0 && q <= maxBuy);
    if (sellBtn) sellBtn.disabled = !(q > 0 && q <= parts);
    calc.innerHTML = `Калькулятор: купить <b>${marketExact(q)}🔧</b> = <b>${marketExact(q * buyPrice)}💎</b> · продать <b>${marketExact(q)}🔧</b> = <b>${marketExact(q * sellPrice)}💎</b>`;
  }

  function marketHistoryRows() {
    let rows = [];
    try { rows = Array.isArray(stageMarketHistory) ? stageMarketHistory : JSON.parse(localStorage.getItem('stageMarketHistory') || '[]'); } catch (_) { rows = []; }
    rows = rows.slice(0, 15);
    if (!rows.length) return '<p>Пока нет сделок в этой сессии.</p>';
    return rows.map((h) => `<div><span>${new Date(h.ts || Date.now()).toLocaleTimeString('ru-RU')}</span> ${h.action === 'buy' ? '🔵 куплено' : '🟢 продано'} <b>${marketExact(h.qty)}🔧</b> за <b>${marketExact(h.cost)}💎</b></div>`).join('');
  }

  renderMarket = function renderMarketExactFullNumbers(data) {
    const box = document.getElementById('marketBox');
    if (!box) return;
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const ordinary = typeof ordinaryCoins === 'function' ? ordinaryCoins(profile) : Number(profile.balance || profile.gold || 0);
    const farm = typeof farmCoins === 'function' ? farmCoins(profile) : Number(profile.farm_balance || profile.farmBalance || 0);
    const bonus = typeof bonusCoins === 'function' ? bonusCoins(profile) : Number(profile.upgrade_balance || profile.upgradeBalance || 0);
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(bonus / buyPrice)));
    const qty = Math.max(0, marketParse(localStorage.getItem('mooseFarmLastMarketQty') || lastMarketQty || 1000));

    box.innerHTML = `
      <div class="quick-status market-current-resources">
        <div><b>Текущие ресурсы</b></div>
        <div class="quick-status-grid">
          <span>💰 Голда: <b>${marketExact(ordinary)}</b></span>
          <span>🌾 Ферма: <b>${marketExact(farm)}</b></span>
          <span>💎 Бонусные: <b>${marketExact(bonus)}</b></span>
          <span>🔧 Запчасти: <b>${marketExact(parts)}</b></span>
        </div>
      </div>
      <div class="market-hero polished-market-hero stage-market-hero">
        <div class="market-stat"><span>📦 Общий склад</span><b>${formatNumber(stock)}🔧</b><small>один склад для всех игроков</small></div>
        <div class="market-stat"><span>🔵 Купить</span><b>${marketExact(buyPrice)}💎 / 1🔧</b><small>максимум: ${formatNumber(maxBuy)}🔧</small></div>
        <div class="market-stat"><span>🟢 Продать</span><b>${marketExact(sellPrice)}💎 / 1🔧</b><small>максимум: ${formatNumber(parts)}🔧</small></div>
      </div>
      <div class="market-preset-row market-preset-row-fixed market-preset-grid market-preset-row-plus">
        ${MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="${s.value}">+${s.label}</button>`).join('')}
        <button type="button" class="market-preset-btn-eq" data-market-max="buy">макс купить</button>
        <button type="button" class="market-preset-btn-eq" data-market-max="sell">макс продать</button>
      </div>
      <div class="market-preset-row market-preset-row-minus market-preset-grid">
        ${MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="-${s.value}">-${s.label}</button>`).join('')}
        <button type="button" class="market-preset-btn-eq" data-market-reset="1">0</button>
      </div>
      <div class="market-actions pretty-actions polished-market-actions">
        <input id="marketQty" type="text" inputmode="text" autocomplete="off" value="${marketExact(qty)}" />
        <button id="marketBuyBtn">🔵 Купить</button>
        <button id="marketSellBtn">🟢 Продать</button>
      </div>
      <p class="market-hint">Поле можно менять кнопками +/- или вручную. Калькулятор всегда считает по текущему значению поля.</p>
      <div id="marketCalc" class="market-calc"></div>
      <div class="market-history"><b>История сделок</b>${marketHistoryRows()}</div>`;

    const input = document.getElementById('marketQty');
    marketSetInput(input, qty || 1000, false);
    input?.addEventListener('input', () => {
      const exact = marketParse(input.value);
      input.dataset.exactQty = String(exact);
      input.dataset.numericValue = String(exact);
      try { lastMarketQty = exact; localStorage.setItem('mooseFarmLastMarketQty', String(exact)); } catch (_) {}
      marketRecalc();
    });
    input?.addEventListener('blur', () => marketSetInput(input, marketGetInput(input)));
    input?.addEventListener('change', () => marketSetInput(input, marketGetInput(input)));
    box.querySelectorAll('[data-market-delta]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, marketGetInput(input) + Number(btn.getAttribute('data-market-delta') || 0));
    }));
    box.querySelectorAll('[data-market-max]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, marketMax(btn.getAttribute('data-market-max')));
    }));
    box.querySelectorAll('[data-market-reset]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, 0);
    }));
    document.getElementById('marketBuyBtn')?.addEventListener('click', (e) => { e.preventDefault(); marketTrade('buy'); });
    document.getElementById('marketSellBtn')?.addEventListener('click', (e) => { e.preventDefault(); marketTrade('sell'); });
    marketRecalc();
  };

  marketTrade = async function marketTradeExactFullNumbers(action) {
    const input = document.getElementById('marketQty');
    const qty = marketGetInput(input);
    if (qty <= 0) {
      showMessage('❌ Рынок: укажи количество больше 0');
      return;
    }
    marketSetInput(input, qty, false);
    const data = await postJson(`/api/farm/market/${action}`, { qty });
    if (!data.ok) {
      const labels = {
        invalid_quantity: 'укажи количество больше 0',
        quantity_too_large: `слишком большое число, максимум ${marketExact(data.maxQty || 0)}🔧`,
        not_enough_parts: `не хватает запчастей: ${marketExact(data.available || 0)}/${marketExact(data.needed || 0)}🔧`,
        not_enough_upgrade_balance: `не хватает 💎: нужно ${marketExact(data.needed || 0)}, есть ${marketExact(data.available || 0)}`,
        market_stock_empty: 'общий склад пуст',
        not_enough_market_stock: 'на общем складе недостаточно 🔧'
      };
      showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
      marketSetInput(input, qty, false);
      await loadMe();
      setTimeout(() => marketSetInput(document.getElementById('marketQty'), qty), 0);
      return;
    }

    try { if (typeof pushMarketHistory === 'function') pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 }); } catch (_) {}
    showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [
      action === 'buy' ? `Куплено: <b>${marketExact(data.qty || qty)}🔧</b>` : `Продано: <b>${marketExact(data.qty || qty)}🔧</b>`,
      action === 'buy' ? `Потрачено: <b>${marketExact(data.totalCost || 0)}💎</b>` : `Получено: <b>${marketExact(data.totalCost || 0)}💎</b>`,
      `Общий склад: <b>${marketExact(data.market?.stock ?? 0)}🔧</b>`
    ], { kind: 'market' });
    marketSetInput(input, qty, false);
    await loadMe();
    setTimeout(() => marketSetInput(document.getElementById('marketQty'), qty), 0);
  };
})();


