/* Extracted from 10-final-patches.js lines 1671-2180. Safe split, logic unchanged. */
/* ==========================================================================
   PATCH: market preset human qty parse only
   ========================================================================== */
(function(){
  function parseMarketHumanQty(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const match = raw.match(/^(\d+(?:\.\d+)?)(кк|kk|к|k|м|m)?$/i);
    if (!match) return Number(raw) || 0;
    const n = Number(match[1] || 0);
    const suffix = match[2] || '';
    if (suffix === 'к' || suffix === 'k') return Math.floor(n * 1000);
    if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') return Math.floor(n * 1000000);
    return Math.floor(n);
  }

  if (typeof window !== 'undefined') {
    window.parseMarketHumanQty = parseMarketHumanQty;
  }

  const oldMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (oldMarketTrade && !window.__mooseMarketHumanQtyPatch) {
    window.__mooseMarketHumanQtyPatch = true;
    marketTrade = async function marketTrade(action) {
      const qtyInput = document.getElementById('marketQty');
      const qty = parseMarketHumanQty(qtyInput?.value || 0);
      if (qtyInput) qtyInput.value = String(qty);
      return oldMarketTrade(action);
    };
  }

  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-market-preset]');
    if (!btn) return;
    const input = document.getElementById('marketQty');
    if (!input) return;
    const preset = String(btn.getAttribute('data-market-preset') || '');
    const map = {
      '1к': 1000,
      '1k': 1000,
      '10к': 10000,
      '10k': 10000,
      '100к': 100000,
      '100k': 100000,
      '1кк': 1000000,
      '1kk': 1000000
    };
    if (map[preset]) {
      input.value = String(map[preset]);
      try {
        lastMarketQty = map[preset];
        localStorage.setItem('mooseFarmLastMarketQty', String(map[preset]));
      } catch (_) {}
    }
  }, true);
})();

/* ==========================================================================
   PATCH: market human presets accumulate + minus row only
   ========================================================================== */
(function(){
  function mqToNumber(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
    if (!m) return Number(raw) || 0;
    const n = Number(m[1] || 0);
    const s = String(m[2] || '').toLowerCase();
    if (s === 'к' || s === 'k') return Math.round(n * 1_000);
    if (s === 'кк' || s === 'kk' || s === 'м' || s === 'm') return Math.round(n * 1_000_000);
    if (s === 'млрд' || s === 'b') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function mqHuman(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    if (n >= 1_000_000_000 && n % 1_000_000_000 === 0) return `${n / 1_000_000_000}млрд`;
    if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}кк`;
    if (n >= 1_000 && n % 1_000 === 0) return `${n / 1_000}к`;
    return String(n);
  }

  function mqSetInput(value) {
    const input = document.getElementById('marketQty');
    if (!input) return;
    const next = Math.max(0, Math.round(Number(value || 0)));
    input.dataset.numericValue = String(next);
    input.value = mqHuman(next);
    try {
      lastMarketQty = next;
      localStorage.setItem('mooseFarmLastMarketQty', String(next));
    } catch (_) {}
    if (typeof updateMarketCalc === 'function') {
      try { updateMarketCalc(); } catch (_) {}
    }
  }

  function mqGetInput() {
    const input = document.getElementById('marketQty');
    if (!input) return 0;
    const parsed = mqToNumber(input.dataset.numericValue || input.value || 0);
    const safe = Math.max(0, parsed);
    input.dataset.numericValue = String(safe);
    input.value = mqHuman(safe);
    return safe;
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketHumanPresets2) {
    window.__mooseMarketHumanPresets2 = true;
    renderMarket = function patchedRenderMarket(data) {
      oldRenderMarket(data);

      const box = document.getElementById('marketBox');
      const input = document.getElementById('marketQty');
      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      if (!box || !input) return;

      const firstRow = box.querySelector('.market-preset-row');
      if (firstRow && !box.querySelector('.market-preset-row-minus')) {
        const minusRow = document.createElement('div');
        minusRow.className = 'market-preset-row market-preset-row-minus';
        minusRow.innerHTML = `
          <button data-market-adjust="-1000">-1к</button>
          <button data-market-adjust="-10000">-10к</button>
          <button data-market-adjust="-100000">-100к</button>
          <button data-market-adjust="-1000000">-1кк</button>
        `;
        firstRow.insertAdjacentElement('afterend', minusRow);
      }

      const profile = data.profile || {};
      const market = data.market || {};
      const stock = Math.max(0, Number(market.stock || 0));
      const buyPrice = Math.max(1, Number(market.buyPrice || 20));
      const parts = Math.max(0, Number(profile.parts || 0));
      const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
      const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
      const maxSell = parts;

      mqSetInput(Number(lastMarketQty || input.dataset.numericValue || mqToNumber(input.value) || 0));

      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, mqToNumber(input.value)));
      });
      input.addEventListener('blur', () => mqSetInput(mqGetInput()));
      input.addEventListener('change', () => mqSetInput(mqGetInput()));

      box.querySelectorAll('[data-market-preset]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const preset = String(btn.getAttribute('data-market-preset') || '').toLowerCase();
          const current = mqGetInput();
          const addMap = {
            '1к': 1000, '1k': 1000, '1000': 1000,
            '10к': 10000, '10k': 10000, '10000': 10000,
            '100к': 100000, '100k': 100000, '100000': 100000,
            '1кк': 1000000, '1kk': 1000000, '1000000': 1000000
          };
          if (preset === 'buymax') return mqSetInput(maxBuy);
          if (preset === 'sellmax') return mqSetInput(maxSell);
          if (Object.prototype.hasOwnProperty.call(addMap, preset)) return mqSetInput(current + addMap[preset]);
        };
      });

      box.querySelectorAll('[data-market-adjust]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const delta = Number(btn.getAttribute('data-market-adjust') || 0);
          mqSetInput(Math.max(0, mqGetInput() + delta));
        };
      });

      if (buyBtn) {
        buyBtn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqHuman(qty);
          input.dataset.numericValue = String(qty);
          input.value = String(qty);
          try {
            await marketTrade('buy');
          } finally {
            input.dataset.numericValue = String(qty);
            input.value = pretty;
          }
        };
      }

      if (sellBtn) {
        sellBtn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqHuman(qty);
          input.dataset.numericValue = String(qty);
          input.value = String(qty);
          try {
            await marketTrade('sell');
          } finally {
            input.dataset.numericValue = String(qty);
            input.value = pretty;
          }
        };
      }
    };
  }
})();

/* ==========================================================================
   PATCH: market human display kk formatting only
   ========================================================================== */
(function(){
  function mqPretty(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    if (n >= 1_000_000_000) {
      const v = n / 1_000_000_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}млрд`;
    }
    if (n >= 1_000_000) {
      const v = n / 1_000_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}кк`;
    }
    if (n >= 1_000) {
      const v = n / 1_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}к`;
    }
    return String(n);
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketPrettyFormatPatch) {
    window.__mooseMarketPrettyFormatPatch = true;
    renderMarket = function patchedRenderMarketPretty(data) {
      oldRenderMarket(data);
      const input = document.getElementById('marketQty');
      if (!input) return;

      const parse = (value) => {
        const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
        if (!raw) return 0;
        const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
        if (!m) return Number(raw) || 0;
        const num = Number(m[1] || 0);
        const suf = String(m[2] || '').toLowerCase();
        if (suf === 'к' || suf === 'k') return Math.round(num * 1_000);
        if (suf === 'кк' || suf === 'kk' || suf === 'м' || suf === 'm') return Math.round(num * 1_000_000);
        if (suf === 'млрд' || suf === 'b') return Math.round(num * 1_000_000_000);
        return Math.round(num);
      };

      const syncPretty = () => {
        const num = Math.max(0, parse(input.dataset.numericValue || input.value || 0));
        input.dataset.numericValue = String(num);
        input.value = mqPretty(num);
      };

      input.addEventListener('blur', syncPretty);
      input.addEventListener('change', syncPretty);
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, parse(input.value)));
      });

      document.querySelectorAll('[data-market-preset],[data-market-adjust]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTimeout(syncPretty, 0);
        });
      });

      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      [buyBtn, sellBtn].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
          setTimeout(syncPretty, 0);
        });
      });

      syncPretty();
    };
  }
})();

/* ==========================================================================
   PATCH: market input sync + equal preset sizes + clearer UX
   ========================================================================== */
(function(){
  function mqParse(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
    if (!m) return Number(raw) || 0;
    const n = Number(m[1] || 0);
    const s = String(m[2] || '').toLowerCase();
    if (s === 'к' || s === 'k') return Math.round(n * 1_000);
    if (s === 'кк' || s === 'kk' || s === 'м' || s === 'm') return Math.round(n * 1_000_000);
    if (s === 'млрд' || s === 'b') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function mqPretty(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    const fmt = (num) => String(num.toFixed(num < 10 ? 2 : num < 100 ? 1 : 0)).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1');
    if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}млрд`;
    if (n >= 1_000_000) return `${fmt(n / 1_000_000)}кк`;
    if (n >= 1_000) return `${fmt(n / 1_000)}к`;
    return String(n);
  }

  function mqGetInput() {
    const input = document.getElementById('marketQty');
    if (!input) return 0;
    const parsed = Math.max(0, mqParse(input.dataset.numericValue || input.value || 0));
    input.dataset.numericValue = String(parsed);
    return parsed;
  }

  function mqSetInput(value, opts = {}) {
    const input = document.getElementById('marketQty');
    if (!input) return;
    const n = Math.max(0, Math.round(Number(value || 0)));
    input.dataset.numericValue = String(n);
    input.value = opts.raw ? String(n) : mqPretty(n);
    try {
      lastMarketQty = n;
      localStorage.setItem('mooseFarmLastMarketQty', String(n));
    } catch (_) {}
    if (typeof updateMarketCalc === 'function') {
      try { updateMarketCalc(); } catch (_) {}
    }
    // Trigger any old listeners that recalc from input/change events
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function ensureCalcMatchesInput() {
    const n = mqGetInput();
    mqSetInput(n);
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketSyncFix) {
    window.__mooseMarketSyncFix = true;
    renderMarket = function patchedRenderMarketSync(data) {
      oldRenderMarket(data);

      const box = document.getElementById('marketBox');
      const input = document.getElementById('marketQty');
      if (!box || !input) return;

      const topRow = box.querySelector('.market-preset-row');
      if (topRow) {
        topRow.classList.add('market-preset-grid');
        topRow.querySelectorAll('button').forEach((btn) => btn.classList.add('market-preset-btn-eq'));
      }
      const minusRow = box.querySelector('.market-preset-row-minus');
      if (minusRow) {
        minusRow.classList.add('market-preset-grid');
        minusRow.querySelectorAll('button').forEach((btn) => btn.classList.add('market-preset-btn-eq'));
      }

      const calc = document.getElementById('marketCalc');
      if (calc && !box.querySelector('.market-calc-hint')) {
        const hint = document.createElement('div');
        hint.className = 'market-calc-hint';
        hint.innerHTML = 'Поле можно менять кнопками <b>+</b>/<b>-</b> или вручную. Калькулятор всегда считает по текущему значению поля.';
        calc.insertAdjacentElement('beforebegin', hint);
      }

      mqSetInput(Number(lastMarketQty || input.dataset.numericValue || mqParse(input.value) || 0));

      const syncPretty = () => ensureCalcMatchesInput();
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('focus', () => {
        const n = mqGetInput();
        input.value = mqPretty(n);
      });
      input.addEventListener('blur', syncPretty);
      input.addEventListener('change', syncPretty);
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, mqParse(input.value)));
        if (typeof updateMarketCalc === 'function') {
          try { updateMarketCalc(); } catch (_) {}
        }
      });

      const addMap = {
        '1к': 1_000, '1k': 1_000, '1000': 1_000,
        '10к': 10_000, '10k': 10_000, '10000': 10_000,
        '100к': 100_000, '100k': 100_000, '100000': 100_000,
        '1кк': 1_000_000, '1kk': 1_000_000, '1000000': 1_000_000
      };

      box.querySelectorAll('[data-market-preset]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const preset = String(btn.getAttribute('data-market-preset') || '').toLowerCase();
          const current = mqGetInput();
          if (preset === 'buymax' || preset === 'макс купить') {
            const market = data.market || {};
            const profile = data.profile || {};
            const stock = Math.max(0, Number(market.stock || 0));
            const buyPrice = Math.max(1, Number(market.buyPrice || 20));
            const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
            return mqSetInput(Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice))));
          }
          if (preset === 'sellmax' || preset === 'макс продать') {
            return mqSetInput(Math.max(0, Number((data.profile || {}).parts || 0)));
          }
          if (Object.prototype.hasOwnProperty.call(addMap, preset)) {
            return mqSetInput(current + addMap[preset]);
          }
        };
      });

      box.querySelectorAll('[data-market-adjust]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const delta = Number(btn.getAttribute('data-market-adjust') || 0);
          mqSetInput(Math.max(0, mqGetInput() + delta));
        };
      });

      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      [buyBtn, sellBtn].forEach((btn, idx) => {
        if (!btn) return;
        const action = idx === 0 ? 'buy' : 'sell';
        btn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqPretty(qty);
          mqSetInput(qty, { raw: true });
          try {
            await marketTrade(action);
          } finally {
            mqSetInput(qty);
            const input = document.getElementById('marketQty');
            if (input) input.value = pretty;
          }
        };
      });

      ensureCalcMatchesInput();
    };
  }
})();


/* ==========================================================================
   PATCH: market single-request lock only
   ========================================================================== */
(function(){
  let marketRequestInFlight = false;

  const prevMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (prevMarketTrade && !window.__mooseMarketSingleRequestLock) {
    window.__mooseMarketSingleRequestLock = true;

    function setMarketButtonsBusy(isBusy) {
      ['marketBuyBtn', 'marketSellBtn'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !!isBusy;
        btn.classList.toggle('is-busy', !!isBusy);
      });
    }

    marketTrade = async function lockedMarketTrade(action) {
      if (marketRequestInFlight) {
        return;
      }

      marketRequestInFlight = true;
      setMarketButtonsBusy(true);

      try {
        const result = await prevMarketTrade(action);
        return result;
      } catch (err) {
        const text = String(err && err.message ? err.message : err || '');
        if (!/action_in_progress/i.test(text)) {
          throw err;
        }
      } finally {
        marketRequestInFlight = false;
        setMarketButtonsBusy(false);
      }
    };
  }

  // If an older handler still produces this backend duplicate response,
  // hide the noisy user-facing message because the first request already succeeded.
  const prevShowMessage = typeof showMessage === 'function' ? showMessage : null;
  if (prevShowMessage && !window.__mooseHideActionInProgressMessage) {
    window.__mooseHideActionInProgressMessage = true;
    showMessage = function patchedShowMessage(message, ...rest) {
      if (/action_in_progress/i.test(String(message || ''))) {
        return;
      }
      return prevShowMessage(message, ...rest);
    };
  }
})();

