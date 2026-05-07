(function () {
  let lootState = null;
  let modalReady = false;

  function esc(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function lootNumber(v) {
    try {
      return typeof formatNumber === 'function' ? formatNumber(Number(v || 0)) : String(Number(v || 0));
    } catch (_) {
      return String(Number(v || 0));
    }
  }

  async function fetchLootState() {
    const res = await fetch('/api/loot/me', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'loot_load_failed');
    lootState = data.loot || null;
    renderLootSummary();
    renderLootModalBody();
    return lootState;
  }

  function ensureLootModal() {
    if (modalReady) return;
    modalReady = true;
    const wrap = document.createElement('div');
    wrap.id = 'lootModal';
    wrap.className = 'loot-modal hidden';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="loot-modal-backdrop" data-loot-close></div>
      <div class="loot-modal-card">
        <div class="loot-modal-head">
          <div>
            <h3>🎁 Донат-инвентарь</h3>
            <p>Баланс, кейсы, промокод и предметы в одном окне.</p>
          </div>
          <button type="button" class="loot-modal-close" data-loot-close>Закрыть ✕</button>
        </div>
        <div id="lootModalBody" class="loot-modal-body"></div>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (event) => {
      if (event.target.closest('[data-loot-close]')) closeLootModal();
    });
  }

  function openLootModal() {
    ensureLootModal();
    const modal = document.getElementById('lootModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (!lootState) {
      fetchLootState().catch((e) => {
        const body = document.getElementById('lootModalBody');
        if (body) body.innerHTML = `<div class="loot-empty">Не удалось загрузить инвентарь: ${esc(e.message)}</div>`;
      });
    }
  }

  function closeLootModal() {
    const modal = document.getElementById('lootModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderLootSummary() {
    const host = document.getElementById('profileLootSummary');
    if (!host) return;
    const loot = lootState;
    if (!loot) {
      host.innerHTML = '<div class="profile-loot-loading">Загрузка донат-инвентаря...</div>';
      return;
    }
    host.innerHTML = `
      <button type="button" class="profile-loot-chip loot-chip-balance" id="openLootModalBtn">
        <span>💳 Донат</span>
        <b>${lootNumber(loot.donateBalance)} ₽</b>
      </button>
      <button type="button" class="profile-loot-chip loot-chip-inventory" id="openLootInventoryBtn">
        <span>📦 Инвентарь</span>
        <b>${lootNumber(loot.inventoryCount)}</b>
      </button>
    `;
    host.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', openLootModal));
  }

  function renderCaseButtons(allowed) {
    return (allowed || []).map((amount) => `
      <button type="button" class="loot-case-btn" data-loot-open="${Number(amount)}">${Number(amount)} ₽</button>
    `).join('');
  }

  function renderRecentTakes(takes) {
    if (!takes || !takes.length) {
      return '<div class="loot-empty small">Пока никто ничего не забирал с этого профиля.</div>';
    }
    return `<div class="loot-recent-list">${takes.map((item) => `
      <div class="loot-recent-row${item.restored ? ' restored' : ''}">
        <b>[${Number(item.entryId || 0)}]</b>
        <span>${esc(item.prizeLabel || 'Предмет')}</span>
        <small>${esc(item.takenDate || '')}${item.restored ? ' · откат' : ''}</small>
      </div>
    `).join('')}</div>`;
  }

  function renderInventory(items) {
    if (!items || !items.length) {
      return '<div class="loot-empty">Инвентарь пуст. Открой кейс или активируй промокод.</div>';
    }
    return `<div class="loot-items-grid">${items.map((item) => `
      <article class="loot-item-card rarity-${esc(item.rarity || 'common')}">
        <div class="loot-item-head">
          <b>[${Number(item.entryId || 0)}]</b>
          <span>${esc(item.caseName || 'Лут')}</span>
        </div>
        <div class="loot-item-label">${esc(item.prizeLabel || 'Предмет')}</div>
        <div class="loot-item-meta">
          <span>Редкость: ${esc(item.rarity || 'common')}</span>
          <span>Открыт: ${esc(item.wonDate || '')}</span>
        </div>
        <div class="loot-item-actions">
          <button type="button" class="loot-action-btn" data-loot-take-id="${Number(item.entryId || 0)}">Забрать</button>
          <button type="button" class="loot-action-btn ghost" data-loot-take-custom="${Number(item.entryId || 0)}" data-loot-label="${esc(item.prizeLabel || '')}">Часть / по названию</button>
        </div>
      </article>
    `).join('')}</div>`;
  }

  function renderLootModalBody() {
    const body = document.getElementById('lootModalBody');
    if (!body) return;
    if (!lootState) {
      body.innerHTML = '<div class="loot-empty">Загрузка...</div>';
      return;
    }
    body.innerHTML = `
      <section class="loot-panel-grid">
        <div class="loot-side-stack">
          <div class="loot-balance-card">
            <div class="loot-balance-main">
              <span>💳 Донат-баланс</span>
              <b>${lootNumber(lootState.donateBalance)} ₽</b>
            </div>
            <small>Этот баланс тратится только на донат-кейсы.</small>
          </div>
          <div class="loot-promo-card">
            <label for="lootPromoInput">🎟 Промокод</label>
            <div class="loot-inline-form">
              <input id="lootPromoInput" placeholder="Например: ${esc(lootState.promoCodeHint || '')}" autocomplete="off" />
              <button type="button" id="lootPromoBtn">Активировать</button>
            </div>
          </div>
          <div class="loot-cases-card">
            <h4>🎰 Открыть кейс</h4>
            <p>Сайт повторяет логику !лут: доступны кейсы на 100 / 200 / 300 / 500 ₽.</p>
            <div class="loot-case-grid">${renderCaseButtons(lootState.allowedCaseAmounts)}</div>
          </div>
          <div class="loot-recent-card">
            <h4>📜 Последние выдачи</h4>
            ${renderRecentTakes(lootState.recentTakes)}
          </div>
        </div>
        <div class="loot-inventory-card">
          <div class="loot-section-head">
            <h4>📦 Твой инвентарь</h4>
            <span>${lootNumber(lootState.inventoryCount)} связок</span>
          </div>
          ${renderInventory(lootState.inventory)}
        </div>
      </section>
    `;

    body.querySelectorAll('[data-loot-open]').forEach((btn) => btn.addEventListener('click', () => openLootCase(Number(btn.getAttribute('data-loot-open')))));
    body.querySelectorAll('[data-loot-take-id]').forEach((btn) => btn.addEventListener('click', () => takeLoot({ mode: 'id', entryId: Number(btn.getAttribute('data-loot-take-id')) })));
    body.querySelectorAll('[data-loot-take-custom]').forEach((btn) => btn.addEventListener('click', () => customTakePrompt(btn)));
    document.getElementById('lootPromoBtn')?.addEventListener('click', activatePromo);
  }

  async function refreshLootAfterAction(data) {
    lootState = data?.snapshot || data?.loot || lootState;
    if (!lootState) await fetchLootState();
    else {
      renderLootSummary();
      renderLootModalBody();
    }
  }

  async function activatePromo() {
    const input = document.getElementById('lootPromoInput');
    const code = String(input?.value || '').trim().toLowerCase();
    if (!code) {
      showMessage?.('❌ Введи промокод.');
      return;
    }
    if (lootState?.promoCodeHint && code !== String(lootState.promoCodeHint).trim().toLowerCase()) {
      showMessage?.('❌ Промокод недействителен.');
      return;
    }
    const data = await postJson('/api/loot/promo', { code });
    if (!data.ok) {
      const labels = {
        promo_invalid: '❌ Промокод недействителен.',
        promo_already_redeemed: '❌ Ты уже активировал этот промокод.',
        not_logged_in: '❌ Нужно войти через Twitch.'
      };
      showMessage?.(labels[data.error] || `❌ Не удалось активировать промокод: ${data.error}`);
      return;
    }
    showMessage?.(`🎁 Промокод активирован. Начислено ${lootNumber(data.amount)} ₽.`);
    await refreshLootAfterAction(data);
  }

  async function openLootCase(amount) {
    const data = await postJson('/api/loot/open', { amount });
    if (!data.ok) {
      const labels = {
        invalid_loot_amount: '❌ Доступны только кейсы на 100 / 200 / 300 / 500 ₽.',
        loot_balance_too_low: `❌ Для открытия нужен минимум 100 ₽ донат-баланса. Сейчас: ${lootNumber(data.available)} ₽.`,
        not_enough_loot_balance: `❌ Не хватает донат-баланса. Сейчас: ${lootNumber(data.available)} ₽, нужно: ${lootNumber(data.needed)} ₽.`
      };
      showMessage?.(labels[data.error] || `❌ Не удалось открыть кейс: ${data.error}`);
      await fetchLootState().catch(() => {});
      return;
    }
    showMessage?.(`🎰 Открыт кейс ${lootNumber(amount)} ₽. Выпало: ${data.merged ? 'пополнение существующей связки' : ''} ${data.prizeLabel || data.winner?.label || 'предмет'}`.trim());
    await refreshLootAfterAction(data);
  }

  function customTakePrompt(btn) {
    const label = btn.getAttribute('data-loot-label') || '';
    const raw = prompt('Введи название и количество, как в !забрать\nПримеры: bolt 1, smoke 6, последний\nТекущая связка: ' + label, 'последний');
    if (!raw) return;
    takeLoot({ query: raw });
  }

  async function takeLoot(request) {
    const payload = typeof request?.query === 'string'
      ? { query: request.query }
      : { request };
    const data = await postJson('/api/loot/take', payload);
    if (!data.ok) {
      const labels = {
        restricted_item_take: '❌ Зажигательные отдельно забирать нельзя. Только через полную связку.',
        inventory_empty: '📦 Инвентарь пуст.',
        inventory_entry_not_found: '❌ Такой ID не найден в инвентаре.',
        inventory_item_not_found: '❌ Такой предмет в нужном количестве не найден.',
        invalid_take_request: '❌ Используй ID, последний или название + количество.'
      };
      showMessage?.(labels[data.error] || `❌ Не удалось забрать предмет: ${data.error}`);
      await fetchLootState().catch(() => {});
      return;
    }
    showMessage?.(`✅ Забрано: [${Number(data.entryId || 0)}] ${data.prizeLabel}${data.partial && data.remainLabel ? `\nОсталось: ${data.remainLabel}` : ''}`);
    await refreshLootAfterAction(data);
  }

  function injectLootSummaryHost() {
    const holder = document.querySelector('.profile-main-left > div');
    if (!holder) return;
    if (document.getElementById('profileLootSummary')) return;
    const box = document.createElement('div');
    box.id = 'profileLootSummary';
    box.className = 'profile-loot-summary';
    holder.appendChild(box);
    renderLootSummary();
  }

  function afterProfileRender() {
    injectLootSummaryHost();
    fetchLootState().catch(() => {
      const host = document.getElementById('profileLootSummary');
      if (host) host.innerHTML = '<div class="profile-loot-loading">Донат-инвентарь временно недоступен</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', ensureLootModal);
  const prevLoadMe = window.loadMe;
  if (typeof prevLoadMe === 'function') {
    window.loadMe = async function patchedLoadMe() {
      const result = await prevLoadMe.apply(this, arguments);
      setTimeout(afterProfileRender, 0);
      return result;
    };
  } else {
    document.addEventListener('DOMContentLoaded', afterProfileRender);
  }
  window.openLootModal = openLootModal;
})();
