/* Safe patch: restore compact admin profile editor view with inline player pick.
   Scope: only admin player editor/search UI. No chat/main page changes. */
(function () {
  const DEFAULT_ADMIN_LOGIN = 'nico_moose';
  let autoLoadTimer = null;
  let lastLoadedLogin = '';

  const fields = [
    ['level', '🌾 Уровень', ''],
    ['farm_balance', '🌾 Ферма', ''],
    ['upgrade_balance', '💎 Бонусные', ''],
    ['parts', '🔧 Запчасти', ''],
    ['license_level', '📜 Лицензия', ''],
    ['raid_power', '⚔️ Рейд-сила', ''],
    ['protection_level', '🛡 Защита', ''],
    ['turret_level', '🔫 Турель ур.', ''],
    ['turret_chance', '🎯 Турель шанс', '%']
  ];

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

  function status(message, error) {
    if (typeof setAdminStatus === 'function') setAdminStatus(message, !!error);
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

  function fieldValue(profile, field) {
    if (field === 'turret_level') return Number(profile?.turret?.level || 0);
    if (field === 'turret_chance') return Number(profile?.turret?.chance || 0);
    return Number(profile?.[field] || 0);
  }

  function editableProfileField(profile, field, label, suffix) {
    return `
      <label class="editable-profile-field admin-edit-profile-field-restored">
        <span>${label}</span>
        <input data-profile-edit-field="${field}" type="number" step="1" value="${fieldValue(profile, field)}" />
        ${suffix ? `<em>${suffix}</em>` : ''}
      </label>`;
  }

  function editableBuildingField(profile, key) {
    const lvl = Number(profile?.farm?.buildings?.[key] || 0);
    const title = profile?.configs?.buildings?.[key]?.name || key;
    return `
      <label class="editable-profile-field admin-edit-profile-field-restored admin-edit-building-field">
        <span>${title}</span>
        <input data-profile-building-field="${key}" type="number" min="0" step="1" value="${lvl}" />
        <em>ключ: ${key} · сейчас ур. ${fmt(lvl)}</em>
      </label>`;
  }

  function knownBuildings(profile) {
    const farmBuildings = profile?.farm?.buildings || {};
    const configBuildings = profile?.configs?.buildings || {};
    const keys = new Set([...Object.keys(configBuildings), ...Object.keys(farmBuildings)]);
    return Array.from(keys).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function renderAdminEditableProfile(profile) {
    const host = document.getElementById('admin-player-info');
    if (!host) return;
    if (!profile) {
      host.innerHTML = '';
      return;
    }

    const login = (profile.login || profile.twitch_login || currentLogin() || DEFAULT_ADMIN_LOGIN).toLowerCase();
    lastLoadedLogin = login;
    setLogin(login);
    const buildings = knownBuildings(profile);

    host.innerHTML = `
      <div class="admin-edit-profile-card admin-edit-profile-card-restored">
        <div class="admin-edit-profile-head">
          <div>
            <h3>${profile.display_name || profile.twitch_login || profile.login || 'unknown'}</h3>
            <small>@${login}</small>
          </div>
          <div class="admin-edit-head-actions">
            <button id="admin-refresh-profile-edit" type="button">↻ Обновить</button>
            <button id="admin-unified-reset-case" type="button">🎰 КД кейса</button>
            <button id="admin-unified-reset-raid" type="button">⚔️ КД рейда</button>
            <button id="admin-unified-reset-offcollect" type="button">🌙 КД оффсбора</button>
          </div>
        </div>

        <div class="editable-profile-grid admin-edit-profile-grid-restored">
          ${fields.map(([field, label, suffix]) => editableProfileField(profile, field, label, suffix)).join('')}
        </div>

        <div class="admin-edit-actions admin-edit-actions-restored">
          <button id="admin-save-all-visible-fields" type="button">💾 Сохранить все поля</button>
        </div>

        <div class="admin-edit-section">
          <h4>🏗 Постройки</h4>
          <div class="admin-edit-buildings admin-edit-buildings-restored">
            ${buildings.length ? buildings.map((key) => editableBuildingField(profile, key)).join('') : '<p>Построек нет.</p>'}
          </div>
          <div class="admin-edit-actions admin-edit-actions-restored">
            <button id="admin-save-all-buildings" type="button">💾 Сохранить все здания</button>
          </div>
        </div>
      </div>`;

    document.getElementById('admin-refresh-profile-edit')?.addEventListener('click', () => {
      reloadPlayer('Игрок обновлён').catch((e) => status(e.message, true));
    });

    document.getElementById('admin-unified-reset-case')?.addEventListener('click', () => {
      resetCooldown('reset-case-cooldown', 'КД кейса сброшен').catch((e) => status(e.message, true));
    });
    document.getElementById('admin-unified-reset-raid')?.addEventListener('click', () => {
      resetCooldown('reset-raid-cooldown', 'КД рейда сброшен').catch((e) => status(e.message, true));
    });
    document.getElementById('admin-unified-reset-offcollect')?.addEventListener('click', () => {
      resetCooldown('reset-offcollect-cooldown', 'КД оффсбора сброшен').catch((e) => status(e.message, true));
    });

    document.getElementById('admin-save-all-visible-fields')?.addEventListener('click', async () => {
      try {
        const login = currentLogin();
        const inputs = Array.from(document.querySelectorAll('[data-profile-edit-field]'));
        for (const input of inputs) {
          await postAdmin('player/set-field', { login, field: input.dataset.profileEditField, value: input.value });
        }
        await reloadPlayer('Все поля сохранены');
      } catch (e) {
        status(e.message, true);
      }
    });

    document.getElementById('admin-save-all-buildings')?.addEventListener('click', async () => {
      try {
        const login = currentLogin();
        const inputs = Array.from(document.querySelectorAll('[data-profile-building-field]'));
        for (const input of inputs) {
          await postAdmin('player/set-building', { login, building: input.dataset.profileBuildingField, level: input.value });
        }
        await reloadPlayer('Все здания сохранены');
      } catch (e) {
        status(e.message, true);
      }
    });
  }

  async function reloadPlayer(message) {
    const login = currentLogin() || DEFAULT_ADMIN_LOGIN;
    setLogin(login);
    const data = await getAdmin('player/' + encodeURIComponent(login));
    renderAdminEditableProfile(data.profile);
    if (message) status(message);
    return data.profile;
  }

  async function resetCooldown(path, message) {
    const login = currentLogin();
    const data = await postAdmin(path, { login });
    if (data.profile) renderAdminEditableProfile(data.profile);
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
      if (event.target === input || box.contains(event.target) || search.contains(event.target)) return;
      hideSuggestions();
    });
  }

  function patchRenderer() {
    window.renderAdminPlayer = renderAdminEditableProfile;
    try { renderAdminPlayer = renderAdminEditableProfile; } catch (_) {}
  }

  function loadDefaultAdminPlayer() {
    const input = document.getElementById('admin-login');
    if (!input || input.dataset.defaultLoaded === '1') return;
    input.dataset.defaultLoaded = '1';
    setLogin(DEFAULT_ADMIN_LOGIN);
    reloadPlayer('Профиль админа загружен').catch(() => {});
  }

  function boot() {
    patchRenderer();
    patchPlayerSearchUi();
    loadDefaultAdminPlayer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();
