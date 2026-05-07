(function () {
  let lootState = null;
  let modalReady = false;
  let selectedLootTileIds = new Set();

  const SUPPORT_LINK = 'https://donatex.gg/donate/nico_moose';

  const ITEM_ICON_MAP = [
    { test: /m4/i, icon: 'https://ru-wiki.rustclash.com/img/items180/shotgun.m4.png', key: 'm4' },
    { test: /bolt/i, icon: 'https://wiki.rustclash.com/img/skins/324/11429.png', key: 'bolt' },
    { test: /l96|l9/i, icon: 'https://ru-wiki.rustclash.com/img/items180/rifle.l96.png', key: 'l96' },
    { test: /smoke|смок/i, icon: 'https://wiki.rustclash.com/img/items180/ammo.grenadelauncher.smoke.png', key: 'smoke' },
    { test: /silencer|сайленсер|сайл|глуш/i, icon: 'https://ru-wiki.rustclash.com/img/items180/weapon.mod.silencer.png', key: 'silencer' },
    { test: /m249|m2/i, icon: 'https://ru-wiki.rustclash.com/img/items180/lmg.m249.png', key: 'm249' },
    { test: /mlrs|млрс/i, icon: 'https://wiki.rustclash.com/img/items180/ammo.rocket.mlrs.png', key: 'mlrs' },
    { test: /max health tea|health tea|чай|tea/i, icon: '/img/maxhealthtea.pure.png', key: 'tea' },
    { test: /jagger|джаггер/i, icon: 'https://ru-wiki.rustclash.com/img/items180/heavy.plate.helmet.png', key: 'jagger' },
    { test: /incendiary|inc|зажига/i, icon: 'https://ru-wiki.rustclash.com/img/items180/ammo.rifle.incendiary.png', key: 'incendiary' }
  ];

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

  function trimText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return trimText(value)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9.]+/gi, '');
  }

  function parsePrizeLabel(label) {
    const text = trimText(label);
    if (!text) return [];
    return text.split(/\s+\+\s+/).map((part) => trimText(part)).filter(Boolean).map((part) => {
      const match = part.match(/^(.*?)(?:\s+x(\d+))?$/i);
      const name = trimText(match?.[1] || part);
      const count = Math.max(1, Number(match?.[2] || 1));
      return { name, count };
    });
  }

  function formatPartsLabel(parts) {
    return (parts || []).map((part) => {
      const count = Math.max(1, Number(part?.count || 1));
      return count > 1 ? `${trimText(part?.name)} x${count}` : trimText(part?.name);
    }).filter(Boolean).join(' + ');
  }

  function expandPartToTiles(part, meta) {
    const name = trimText(part?.name);
    const total = Math.max(1, Number(part?.count || 1));
    const key = getItemVisualKey(name);
    const tiles = [];

    function pushTile(count) {
      tiles.push({
        name,
        count,
        stackRule: key,
        icon: getItemIcon(name),
        ...meta
      });
    }

    if (!name) return tiles;

    if (key === 'smoke') {
      let left = total;
      while (left > 0) {
        const amount = left >= 6 ? 6 : left;
        pushTile(amount);
        left -= amount;
      }
      return tiles;
    }

    if (key === 'incendiary' || key === 'tea') {
      pushTile(total);
      return tiles;
    }

    for (let i = 0; i < total; i += 1) pushTile(1);
    return tiles;
  }

  function getTileSortWeight(tile) {
    const order = {
      l96: 1,
      bolt: 2,
      m4: 3,
      m249: 4,
      silencer: 5,
      jagger: 6,
      smoke: 7,
      mlrs: 8,
      tea: 9,
      incendiary: 10
    };
    return order[getItemVisualKey(tile?.name)] || 99;
  }

  function mergePartMaps(parts) {
    const order = [];
    const map = new Map();
    (parts || []).forEach((part) => {
      const name = trimText(part?.name);
      const count = Math.max(1, Number(part?.count || 1));
      const key = normalizeKey(name);
      if (!name || !key) return;
      if (!map.has(key)) {
        map.set(key, { name, count: 0 });
        order.push(key);
      }
      map.get(key).count += count;
    });
    return order.map((key) => map.get(key));
  }

  function getItemIcon(itemName) {
    const text = trimText(itemName);
    const match = ITEM_ICON_MAP.find((item) => item.test.test(text));
    return match ? match.icon : '';
  }

  function getItemVisualKey(itemName) {
    const text = trimText(itemName);
    const match = ITEM_ICON_MAP.find((item) => item.test.test(text));
    return match ? match.key : normalizeKey(text) || 'loot';
  }

  function buildInventoryTiles(inventory) {
    const tiles = [];
    (inventory || []).forEach((entry) => {
      const entryId = Number(entry?.entryId || 0);
      const rarity = entry?.rarity || 'common';
      const visualLevel = Number(entry?.visualLevel || 1);
      const caseName = trimText(entry?.caseName || 'Лут');
      const wonDate = trimText(entry?.wonDate || '');
      parsePrizeLabel(entry?.prizeLabel || '').forEach((part, index) => {
        const expanded = expandPartToTiles(part, {
          entryId,
          rarity,
          visualLevel,
          caseName,
          wonDate,
          sourceIndex: index
        });
        expanded.forEach((tile, tileIndex) => {
          tiles.push({
            selectionId: `${entryId}::${getItemVisualKey(tile.name)}::${index}::${tileIndex}::${tile.count}`,
            entryId,
            name: trimText(tile.name),
            count: Math.max(1, Number(tile.count || 1)),
            rarity,
            visualLevel,
            caseName,
            wonDate,
            icon: tile.icon || getItemIcon(tile.name)
          });
        });
      });
    });

    tiles.sort((a, b) => {
      const weightDiff = getTileSortWeight(a) - getTileSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      const nameDiff = trimText(a.name).localeCompare(trimText(b.name), 'ru');
      if (nameDiff !== 0) return nameDiff;
      const countDiff = Number(a.count || 1) - Number(b.count || 1);
      if (countDiff !== 0) return countDiff;
      const caseDiff = trimText(a.caseName).localeCompare(trimText(b.caseName), 'ru');
      if (caseDiff !== 0) return caseDiff;
      const dateDiff = trimText(a.wonDate).localeCompare(trimText(b.wonDate), 'ru');
      if (dateDiff !== 0) return dateDiff;
      return Number(a.entryId || 0) - Number(b.entryId || 0);
    });

    return tiles;
  }

  function getLootTiles() {
    return buildInventoryTiles(lootState?.inventory || []);
  }

  function getSelectedLootTiles() {
    const selected = [];
    const ids = selectedLootTileIds;
    getLootTiles().forEach((tile) => {
      if (ids.has(tile.selectionId)) selected.push(tile);
    });
    return selected;
  }

  function pruneSelectedLootTiles() {
    const available = new Set(getLootTiles().map((tile) => tile.selectionId));
    selectedLootTileIds.forEach((id) => {
      if (!available.has(id)) selectedLootTileIds.delete(id);
    });
  }

  async function fetchLootState() {
    const res = await fetch('/api/loot/me', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'loot_load_failed');
    lootState = data.loot || null;
    pruneSelectedLootTiles();
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
        <div class="loot-modal-head premium">
          <div>
            <h3>🎁 Донат-инвентарь</h3>
            <p>Премиум-инвентарь лута и выдач для стрима.</p>
          </div>
          <div class="loot-modal-head-actions">
            <a class="loot-support-link" href="${SUPPORT_LINK}" target="_blank" rel="noopener noreferrer">💚 Поддержать</a>
            <button type="button" class="loot-modal-close" data-loot-close>Закрыть ✕</button>
          </div>
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
    const tiles = getLootTiles();
    host.innerHTML = `
      <div class="profile-loot-summary-card">
        <button type="button" class="profile-loot-chip loot-chip-balance" data-loot-open-modal>
          <span>💳 Донат-баланс</span>
          <b>${lootNumber(loot.donateBalance)} ₽</b>
        </button>
        <button type="button" class="profile-loot-chip loot-chip-inventory" data-loot-open-modal>
          <span>🧩 Предметы</span>
          <b>${lootNumber(tiles.length)}</b>
        </button>
        <a class="profile-loot-chip loot-chip-support" href="${SUPPORT_LINK}" target="_blank" rel="noopener noreferrer">
          <span>💚 Поддержка</span>
          <b>Donatex</b>
        </a>
      </div>
    `;
    host.querySelectorAll('[data-loot-open-modal]').forEach((btn) => btn.addEventListener('click', openLootModal));
  }

  function renderCaseButtons(allowed) {
    return (allowed || []).map((amount) => `
      <button type="button" class="loot-case-btn" data-loot-open="${Number(amount)}">
        <span>${Number(amount)}</span>
        <small>₽</small>
      </button>
    `).join('');
  }

  function renderRecentTakes(takes) {
    if (!takes || !takes.length) {
      return '<div class="loot-empty small">Пока никто ничего не забирал с этого профиля.</div>';
    }
    return `<div class="loot-recent-list">${takes.map((item) => `
      <div class="loot-recent-row${item.restored ? ' restored' : ''}">
        <div class="loot-recent-main">
          <b>${esc(item.prizeLabel || 'Предмет')}</b>
          <span>${esc(item.caseName || 'Лут')}</span>
        </div>
        <small>${esc(item.takenDate || '')}${item.restored ? ' · откат' : ''}</small>
      </div>
    `).join('')}</div>`;
  }

  function renderSelectionPills(selectedTiles) {
    if (!selectedTiles.length) {
      return '<div class="loot-empty inline">Выбери один или несколько предметов в инвентаре.</div>';
    }
    const merged = mergePartMaps(selectedTiles.map((tile) => ({ name: tile.name, count: tile.count })));
    return merged.map((part) => `
      <div class="loot-selection-pill">
        <span>${esc(part.name)}</span>
        <b>x${Number(part.count || 1)}</b>
      </div>
    `).join('');
  }

  function renderInventoryTiles(tiles, selectedTiles) {
    if (!tiles.length) {
      return '<div class="loot-empty">Инвентарь пуст. Открой кейс или активируй промокод.</div>';
    }
    const selectedIds = new Set((selectedTiles || []).map((tile) => tile.selectionId));
    return `<div class="loot-icon-grid">${tiles.map((tile) => `
      <button type="button" class="loot-icon-tile rarity-${esc(tile.rarity || 'common')}${selectedIds.has(tile.selectionId) ? ' selected' : ''}" data-loot-select-id="${esc(tile.selectionId)}">
        <div class="loot-icon-topline">
          <span>${esc(tile.caseName || 'Лут')}</span>
          <strong>${esc(tile.rarity || 'common')}</strong>
        </div>
        <div class="loot-icon-frame">
          ${tile.icon ? `<img src="${esc(tile.icon)}" alt="${esc(tile.name)}">` : `<div class="loot-icon-fallback">${esc((tile.name || '?').slice(0, 2).toUpperCase())}</div>`}
          <div class="loot-icon-count">x${Number(tile.count || 1)}</div>
          <div class="loot-icon-check">✓</div>
        </div>
        <div class="loot-icon-name">${esc(tile.name)}</div>
        <div class="loot-icon-date">${esc(tile.wonDate || '')}</div>
      </button>
    `).join('')}</div>`;
  }

  function renderLootModalBody() {
    const body = document.getElementById('lootModalBody');
    if (!body) return;
    if (!lootState) {
      body.innerHTML = '<div class="loot-empty">Загрузка...</div>';
      return;
    }

    const allTiles = getLootTiles();
    const selectedTiles = getSelectedLootTiles();
    const inventoryCount = allTiles.length;

    body.innerHTML = `
      <section class="loot-premium-dashboard">
        <div class="loot-top-stats">
          <div class="loot-stat-card hero">
            <span>Баланс</span>
            <b>${lootNumber(lootState.donateBalance)} ₽</b>
            <small>Тратится только на кейсы</small>
          </div>
          <div class="loot-stat-card">
            <span>Предметов</span>
            <b>${lootNumber(inventoryCount)}</b>
            <small>Иконок в инвентаре</small>
          </div>
          <div class="loot-stat-card">
            <span>Выбрано</span>
            <b>${lootNumber(selectedTiles.length)}</b>
            <small>Готово к выдаче</small>
          </div>
        </div>

        <section class="loot-panel-grid premium">
          <div class="loot-side-stack premium">
            <div class="loot-promo-card premium">
              <label for="lootPromoInput">🎟 Промокод</label>
              <div class="loot-inline-form premium">
                <input id="lootPromoInput" placeholder="Например: ${esc(lootState.promoCodeHint || '')}" autocomplete="off" />
                <button type="button" id="lootPromoBtn">Активировать</button>
              </div>
            </div>

            <div class="loot-cases-card premium">
              <div class="loot-card-headline">
                <h4>🎰 Кейсы</h4>
                <a class="loot-support-link subtle" href="${SUPPORT_LINK}" target="_blank" rel="noopener noreferrer">Поддержать</a>
              </div>
              <div class="loot-case-grid premium">${renderCaseButtons(lootState.allowedCaseAmounts)}</div>
            </div>

            <div class="loot-recent-card premium">
              <h4>📜 Последние выдачи</h4>
              ${renderRecentTakes(lootState.recentTakes)}
            </div>
          </div>

          <div class="loot-inventory-card premium">
            <div class="loot-section-head premium">
              <div>
                <h4>📦 Инвентарь предметов</h4>
                <p>Нажми на один или несколько предметов, затем забери их одной кнопкой.</p>
              </div>
              <span>${lootNumber(inventoryCount)} шт.</span>
            </div>

            <div class="loot-selection-bar">
              <div class="loot-selection-meta">
                <span>Выбрано:</span>
                <b>${lootNumber(selectedTiles.length)}</b>
              </div>
              <div class="loot-selection-pills-wrap">${renderSelectionPills(selectedTiles)}</div>
              <div class="loot-selection-actions">
                <button type="button" class="loot-action-btn ghost" id="lootClearSelectionBtn" ${selectedTiles.length ? '' : 'disabled'}>Сбросить</button>
                <button type="button" class="loot-action-btn" id="lootTakeSelectedBtn" ${selectedTiles.length ? '' : 'disabled'}>Забрать выбранное</button>
              </div>
            </div>

            ${renderInventoryTiles(allTiles, selectedTiles)}
          </div>
        </section>
      </section>
    `;

    body.querySelectorAll('[data-loot-open]').forEach((btn) => btn.addEventListener('click', () => openLootCase(Number(btn.getAttribute('data-loot-open')))));
    body.querySelectorAll('[data-loot-select-id]').forEach((btn) => btn.addEventListener('click', () => toggleLootSelection(btn.getAttribute('data-loot-select-id'))));
    document.getElementById('lootPromoBtn')?.addEventListener('click', activatePromo);
    document.getElementById('lootTakeSelectedBtn')?.addEventListener('click', takeSelectedLoot);
    document.getElementById('lootClearSelectionBtn')?.addEventListener('click', clearLootSelection);
  }

  function toggleLootSelection(selectionId) {
    if (!selectionId) return;
    if (selectedLootTileIds.has(selectionId)) selectedLootTileIds.delete(selectionId);
    else selectedLootTileIds.add(selectionId);
    renderLootModalBody();
  }

  function clearLootSelection() {
    selectedLootTileIds.clear();
    renderLootModalBody();
  }

  async function refreshLootAfterAction(data) {
    lootState = data?.snapshot || data?.loot || lootState;
    pruneSelectedLootTiles();
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
    selectedLootTileIds.clear();
    const winnerLabel = data.winner?.label || data.prizeLabel || 'предмет';
    showMessage?.(`🎰 Выпало: ${winnerLabel}`);
    await refreshLootAfterAction(data);
  }

  async function takeSelectedLoot() {
    const selectedTiles = getSelectedLootTiles();
    if (!selectedTiles.length) {
      showMessage?.('❌ Сначала выбери предметы.');
      return;
    }
    const selections = selectedTiles.map((tile) => ({
      entryId: Number(tile.entryId || 0),
      itemName: tile.name,
      amount: Number(tile.count || 1)
    }));
    const data = await postJson('/api/loot/take-selection', { selections });
    if (!data.ok) {
      const labels = {
        loot_selection_empty: '❌ Ничего не выбрано.',
        inventory_empty: '📦 Инвентарь пуст.',
        inventory_entry_not_found: '❌ Один из выбранных предметов уже исчез из инвентаря.',
        inventory_item_not_found: '❌ Один из выбранных предметов больше недоступен.'
      };
      showMessage?.(labels[data.error] || `❌ Не удалось забрать выбранные предметы: ${data.error}`);
      await fetchLootState().catch(() => {});
      return;
    }
    selectedLootTileIds.clear();
    showMessage?.(`✅ Забрано: ${data.prizeLabel}`);
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
