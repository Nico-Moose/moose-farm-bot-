/* Safe patch: compact unified admin editor with autoload player pick.
   Only touches admin panel UI and admin endpoints. */
(function () {
  const DEFAULT_ADMIN_LOGIN = 'nico_moose';
  let autoLoadTimer = null;
  let lastLoadedLogin = '';

  function fmt(value) {
    if (typeof stageFormat === 'function') return stageFormat(value || 0);
    return String(value ?? 0);
  }

  function currentLogin() {
    const input = document.getElementById('admin-login');
    return String(input?.value || '').trim().toLowerCase().replace(/^@/, '');
  }

  function setLogin(login) {
    const input = document.getElementById('admin-login');
    if (input && login) input.value = String(login).toLowerCase().replace(/^@/, '');
  }

  async function getAdmin(path) {
    if (typeof adminGet === 'function') return adminGet(path);
    const res = await fetch('/api/admin/' + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Ошибка загрузки');
    return data;
  }

  async function postAdmin(path, body) {
    if (typeof adminPost === 'function') return adminPost(path, body);
    const res = await fetch('/api/admin/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Ошибка админ-действия');
    return data;
  }

  function status(message, error) {
    if (typeof setAdminStatus === 'function') setAdminStatus(message, !!error);
  }

  const fieldDefinitions = [
    ['level', '🌾 Уровень', '0+'],
    ['twitch_balance', '💰 Голда', '0+'],
    ['farm_balance', '🌾 Ферма', 'можно отрицательное'],
    ['upgrade_balance', '💎 Бонусные', '0+'],
    ['parts', '🔧 Запчасти', '0+'],
    ['license_level', '📜 Лицензия', '0+'],
    ['raid_power', '⚔️ Рейд-сила', '0+'],
    ['protection_level', '🛡 Защита', '0+'],
    ['turret_level', '🔫 Турель ур.', '0+']
  ];

  function fieldValue(profile, field) {
    if (field === 'turret_level') return Number(profile?.turret?.level || 0);
    return Number(profile?.[field] || 0);
  }

  function buildFieldCard(profile, field, label, hint) {
    const value = fieldValue(profile, field);
    return `<div class="admin-field-card admin-field-card-compact" data-admin-field-card="${field}">
      <label>${label}</label>
      <input type="number" step="1" data-admin-field="${field}" value="${String(value).replace(/"/g, '&quot;')}" />
      <small>${hint} · сейчас ${fmt(value)}</small>
    </div>`;
  }

  function knownBuildings(profile) {
    const farmBuildings = profile?.farm?.buildings || {};
    const configBuildings = profile?.configs?.buildings || {};
    const keys = new Set([...Object.keys(configBuildings), ...Object.keys(farmBuildings)]);
    return Array.from(keys).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function buildBuildingCard(profile, key) {
    const level = Number(profile?.farm?.buildings?.[key] || 0);
    const title = profile?.configs?.buildings?.[key]?.name || key;
    return `<div class="admin-building-card admin-building-card-compact" data-admin-building-card="${key}">
      <label>${title}</label>
      <input type="number" step="1" min="0" data-admin-building="${key}" value="${level}" />
      <small>ключ: ${key} · сейчас ур. ${fmt(level)}</small>
    </div>`;
  }

  function renderUnifiedEditor(profile) {
    const box = document.getElementById('admin-player-info');
    if (!box) return;
    if (!profile) {
      box.innerHTML = '';
      return;
    }

    const login = (profile.login || profile.twitch_login || currentLogin() || DEFAULT_ADMIN_LOGIN).toLowerCase();
    lastLoadedLogin = login;
    setLogin(login);
    const buildings = knownBuildings(profile);

    box.innerHTML = `<section class="admin-unified-editor admin-unified-editor-compact">
      <div class="admin-unified-head">
        <div>
          <h2>${profile.display_name || profile.twitch_login || profile.login || 'unknown'}</h2>
          <small>@${login}</small>
        </div>
        <div class="admin-unified-actions">
          <button type="button" id="admin-unified-refresh">↻ Обновить</button>
          <button type="button" id="admin-unified-reset-case">🎰 КД кейса</button>
          <button type="button" id="admin-unified-reset-raid">⚔️ КД рейда</button>
          <button type="button" id="admin-unified-reset-offcollect">🌙 КД оффсбора</button>
        </div>
      </div>

      <div class="admin-unified-grid compact-grid-top">
        ${fieldDefinitions.map((item) => buildFieldCard(profile, ...item)).join('')}
      </div>

      <div class="admin-save-all-row">
        <button type="button" id="admin-unified-save-all-fields">💾 Сохранить все поля</button>
      </div>

      <div class="admin-unified-section">
        <h3>🏗 Постройки</h3>
        <div class="admin-buildings-editor-grid compact-buildings-grid">
          ${buildings.length ? buildings.map((key) => buildBuildingCard(profile, key)).join('') : '<p class="admin-muted">Построек и конфигов зданий пока нет.</p>'}
        </div>
        <div class="admin-save-all-row admin-save-buildings-row">
          <button type="button" id="admin-unified-save-all-buildings">💾 Сохранить все здания</button>
        </div>
      </div>
    </section>`;
  }

  async function reloadPlayer(message) {
    const login = currentLogin() || DEFAULT_ADMIN_LOGIN;
    setLogin(login);
    const data = await getAdmin('player/' + encodeURIComponent(login));
    renderUnifiedEditor(data.profile);
    if (message) status(message);
    return data.profile;
  }

  async function saveAllFields() {
    const login = currentLogin();
    if (!login) throw new Error('Укажи ник игрока');

    const fields = {};
    for (const [field] of fieldDefinitions) {
      const input = document.querySelector(`[data-admin-field="${CSS.escape(field)}"]`);
      if (input) fields[field] = input.value || '0';
    }

    const data = await postAdmin('player/set-fields-batch', { login, fields });
    if (data.profile) renderUnifiedEditor(data.profile);
    else await reloadPlayer();
    status(data.message || 'Все поля игрока сохранены');
  }

  async function saveAllBuildings() {
    const login = currentLogin();
    if (!login) throw new Error('Укажи ник игрока');

    const buildings = {};
    const nodes = Array.from(document.querySelectorAll('[data-admin-building]'));
    for (const input of nodes) {
      const key = input.getAttribute('data-admin-building');
      if (key) buildings[key] = input.value || '0';
    }

    const data = await postAdmin('player/set-buildings-batch', { login, buildings });
    if (data.profile) renderUnifiedEditor(data.profile);
    else await reloadPlayer();
    status(data.message || 'Все здания игрока сохранены');
  }

  async function resetCooldown(path, message) {
    const login = currentLogin();
    const data = await postAdmin(path, { login });
    if (data.profile) renderUnifiedEditor(data.profile);
    else await reloadPlayer();
    status(data.message || message);
  }

  async function fetchAdminPlayers(prefix) {
    try {
      const data = await getAdmin('players?prefix=' + encodeURIComponent(prefix || ''));
      return data.players || [];
    } catch (_) {
      return [];
    }
  }

  function hideSuggestions() {
    const box = document.getElementById('admin-player-suggestions');
    if (!box) return;
    box.classList.add('hidden');
  }

  function renderPlayerSuggestions(players) {
    const box = document.getElementById('admin-player-suggestions');
    if (!box) return;
    if (!players.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }

    box.innerHTML = players.map((p) => {
      const login = String(p.login || p.twitch_login || '').toLowerCase();
      const display = p.display_name || p.twitch_login || p.login || login;
      const level = Number(p.level || 0);
      return `<button type="button" data-admin-unified-suggest="${login}"><b>${login}</b><small>${display} · ур. ${level}</small></button>`;
    }).join('');
    box.classList.remove('hidden');
  }

  function queueAutoLoad(login) {
    const normalized = String(login || '').trim().toLowerCase().replace(/^@/, '');
    if (!normalized || normalized === lastLoadedLogin) return;
    clearTimeout(autoLoadTimer);
    autoLoadTimer = setTimeout(() => {
      setLogin(normalized);
      reloadPlayer('Игрок загружен').catch((e) => status(e.message, true));
    }, 120);
  }

  function patchPlayerSearchUi() {
    const search = document.querySelector('.admin-player-search');
    const input = document.getElementById('admin-login');
    const box = document.getElementById('admin-player-suggestions');
    if (!search || !input || !box || search.dataset.unifiedSearchReady === '1') return;
    search.dataset.unifiedSearchReady = '1';
    search.classList.add('admin-player-search-autoload');

    async function updateSuggestions(force) {
      const prefix = currentLogin();
      if (!force && prefix.length < 1) {
        hideSuggestions();
        box.innerHTML = '';
        return;
      }
      const players = await fetchAdminPlayers(prefix);
      renderPlayerSuggestions(players);

      if (players.length === 1) {
        const exactLogin = String(players[0].login || players[0].twitch_login || '').toLowerCase();
        if (exactLogin && exactLogin === prefix) {
          hideSuggestions();
          queueAutoLoad(exactLogin);
        }
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(autoLoadTimer);
      setTimeout(() => updateSuggestions(false), 100);
    });

    input.addEventListener('focus', () => updateSuggestions(true).catch(() => {}));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        hideSuggestions();
        queueAutoLoad(currentLogin());
      }
    });

    box.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-admin-unified-suggest], [data-admin-suggest]');
      if (!btn) return;
      const login = btn.getAttribute('data-admin-unified-suggest') || btn.getAttribute('data-admin-suggest');
      setLogin(login);
      hideSuggestions();
      queueAutoLoad(login);
    });

    document.addEventListener('click', (event) => {
      if (event.target === input || search.contains(event.target)) return;
      hideSuggestions();
    });
  }

  function patchRenderer() {
    window.renderAdminPlayer = renderUnifiedEditor;
    try { renderAdminPlayer = renderUnifiedEditor; } catch (_) {}
  }

  function patchLegacyViewButtons() {
    document.getElementById('admin-load-player')?.remove();
    document.getElementById('admin-view-player-page')?.remove();
  }

  async function loadDefaultAdminPlayer() {
    const input = document.getElementById('admin-login');
    if (!input || input.dataset.defaultLoaded === '1') return;
    input.dataset.defaultLoaded = '1';
    try {
      const me = await getAdmin('me');
      setLogin(me.login || DEFAULT_ADMIN_LOGIN);
      await reloadPlayer('Профиль админа загружен');
    } catch (e) {
      setLogin(DEFAULT_ADMIN_LOGIN);
      reloadPlayer().catch(() => {});
    }
  }

  function bindUnifiedClicks() {
    const panel = document.getElementById('admin-panel');
    if (!panel || panel.dataset.unifiedEditorReady === '1') return;
    panel.dataset.unifiedEditorReady = '1';

    panel.addEventListener('click', (event) => {
      if (event.target.closest('#admin-unified-refresh')) {
        reloadPlayer('Игрок обновлён').catch((e) => status(e.message, true));
        return;
      }
      if (event.target.closest('#admin-unified-reset-case') || event.target.closest('#admin-reset-case-cooldown')) {
        resetCooldown('reset-case-cooldown', 'КД кейса сброшен').catch((e) => status(e.message, true));
        return;
      }
      if (event.target.closest('#admin-unified-reset-raid') || event.target.closest('#admin-reset-raid')) {
        resetCooldown('reset-raid-cooldown', 'КД рейда сброшен').catch((e) => status(e.message, true));
        return;
      }
      if (event.target.closest('#admin-unified-reset-offcollect') || event.target.closest('#admin-reset-offcollect-cooldown')) {
        resetCooldown('reset-offcollect-cooldown', 'КД оффсбора сброшен').catch((e) => status(e.message, true));
        return;
      }
      if (event.target.closest('#admin-unified-save-all-fields')) {
        saveAllFields().catch((e) => status(e.message, true));
        return;
      }
      if (event.target.closest('#admin-unified-save-all-buildings')) {
        saveAllBuildings().catch((e) => status(e.message, true));
        return;
      }
    });
  }


  async function loadFarmersList() {
    const list = document.getElementById('admin-farmers-list');
    const meta = document.getElementById('admin-farmers-meta');
    if (!list || !meta) return;

    const sort = document.getElementById('admin-farmers-sort')?.value || 'level';
    const prefix = String(document.getElementById('admin-farmers-search')?.value || '').trim().toLowerCase().replace(/^@/, '');

    list.innerHTML = '<div class="admin-farmers-empty">Загрузка списка фермеров...</div>';
    const data = await getAdmin('farmers?sort=' + encodeURIComponent(sort) + '&prefix=' + encodeURIComponent(prefix));
    const farmers = Array.isArray(data.farmers) ? data.farmers : [];
    const total = Number(data.total || farmers.length || 0);

    meta.textContent = 'Всего фермеров: ' + total;

    if (!farmers.length) {
      list.innerHTML = '<div class="admin-farmers-empty">Фермеры не найдены.</div>';
      return;
    }

    list.innerHTML = farmers.map((farmer, idx) => {
      const pos = Number(farmer.position || (idx + 1));
      const login = String(farmer.login || '').toLowerCase();
      const display = farmer.display_name || farmer.login || login;
      const level = Number(farmer.level || 0);
      const farmBalance = fmt(farmer.farm_balance || 0);
      const parts = fmt(farmer.parts || 0);
      return `<div class="admin-farmer-row" data-farmer-login-row="${login}">
        <button type="button" class="admin-farmer-card" data-admin-farmer-open="${login}">
          <div class="admin-farmer-index">${pos}/${total}</div>
          <div class="admin-farmer-main">
            <div class="admin-farmer-name">${display}</div>
            <div class="admin-farmer-login">@${login}</div>
          </div>
          <div class="admin-farmer-stats">
            <span>🌾 ур. ${level}</span>
            <span>🌾 ${farmBalance}</span>
            <span>🔧 ${parts}</span>
          </div>
        </button>
        <button type="button" class="admin-farmer-delete danger" data-admin-farmer-delete="${login}">Удалить фермера</button>
      </div>`;
    }).join('');
  }

  async function fetchFarmersSuggestions(prefix) {
    try {
      const data = await getAdmin('farmers?sort=alphabet&prefix=' + encodeURIComponent(prefix || '') + '&limit=12');
      return data.farmers || [];
    } catch (_) {
      return [];
    }
  }

  function renderFarmersSuggestions(items) {
    const box = document.getElementById('admin-farmers-suggestions');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '';
      box.classList.add('hidden');
      return;
    }
    box.innerHTML = items.map((p) => {
      const login = String(p.login || '').toLowerCase();
      const display = p.display_name || p.login || login;
      return `<button type="button" data-admin-farmers-suggest="${login}"><b>${display}</b><small>@${login} · ур. ${Number(p.level || 0)}</small></button>`;
    }).join('');
    box.classList.remove('hidden');
  }

  function applyAdminTabModes() {
    const activeTab = document.querySelector('[data-admin-tab].active')?.getAttribute('data-admin-tab');
    const hideTop = activeTab === 'journal' || activeTab === 'farmers';
    const playerInfo = document.getElementById('admin-player-info');
    const playerSearch = document.querySelector('.admin-player-search');
    if (playerInfo) playerInfo.style.display = hideTop ? 'none' : '';
    if (playerSearch) playerSearch.style.display = hideTop ? 'none' : '';
    if (activeTab === 'farmers') {
      loadFarmersList().catch((e) => status(e.message, true));
    }
  }

  function setupFarmersTab() {
    const panel = document.getElementById('admin-panel');
    const searchInput = document.getElementById('admin-farmers-search');
    const suggestBox = document.getElementById('admin-farmers-suggestions');
    if (!panel || !searchInput || panel.dataset.farmersTabReady === '1') return;
    panel.dataset.farmersTabReady = '1';
    let timer = null;

    document.getElementById('admin-farmers-refresh')?.addEventListener('click', () => {
      loadFarmersList().catch((e) => status(e.message, true));
    });
    document.getElementById('admin-farmers-sort')?.addEventListener('change', () => {
      loadFarmersList().catch((e) => status(e.message, true));
    });
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const prefix = String(searchInput.value || '').trim().toLowerCase().replace(/^@/, '');
        const items = await fetchFarmersSuggestions(prefix);
        renderFarmersSuggestions(items);
        loadFarmersList().catch((e) => status(e.message, true));
      }, 120);
    });
    searchInput.addEventListener('focus', async () => {
      const prefix = String(searchInput.value || '').trim().toLowerCase().replace(/^@/, '');
      renderFarmersSuggestions(await fetchFarmersSuggestions(prefix));
    });
    suggestBox?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-admin-farmers-suggest]');
      if (!btn) return;
      const login = btn.getAttribute('data-admin-farmers-suggest');
      searchInput.value = login;
      suggestBox.classList.add('hidden');
      loadFarmersList().catch((e) => status(e.message, true));
    });
    document.addEventListener('click', (event) => {
      if (event.target === searchInput || suggestBox?.contains(event.target)) return;
      suggestBox?.classList.add('hidden');
    });

    panel.addEventListener('click', async (event) => {
      const delBtn = event.target.closest('[data-admin-farmer-delete]');
      if (delBtn) {
        const login = delBtn.getAttribute('data-admin-farmer-delete');
        if (!login) return;
        if (!confirm('Удалить фермера ' + login + '? После этого игроку нужно будет снова покупать ферму.')) return;
        try {
          await postAdmin('delete-farmer', { login });
          if (currentLogin() === login) {
            const input = document.getElementById('admin-login');
            if (input) input.value = '';
            renderUnifiedEditor(null);
          }
          status('Фермер удалён из списка');
          loadFarmersList().catch((e) => status(e.message, true));
        } catch (e) {
          status(e.message, true);
        }
        return;
      }
      const openBtn = event.target.closest('[data-admin-farmer-open]');
      if (openBtn) {
        const login = openBtn.getAttribute('data-admin-farmer-open');
        if (!login) return;
        setLogin(login);
        document.querySelector('[data-admin-tab="extended"]')?.click();
        reloadPlayer('Игрок загружен').catch((e) => status(e.message, true));
      }
    });

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => btn.addEventListener('click', () => setTimeout(applyAdminTabModes, 0)));
  }

  function boot() {
    patchRenderer();
    patchPlayerSearchUi();
    patchLegacyViewButtons();
    bindUnifiedClicks();
    setupFarmersTab();
    loadDefaultAdminPlayer();
    applyAdminTabModes();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
  setTimeout(applyAdminTabModes, 700);
})();
