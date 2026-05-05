/* Safe patch: unified admin player editor.
   Only touches admin panel UI and admin endpoints. */
(function () {
  const DEFAULT_ADMIN_LOGIN = 'nico_moose';
  let lastProfile = null;

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

  const fields = [
    ['level', '🌾 Уровень', '0+'],
    ['farm_balance', '🌾 Ферма', 'можно отрицательное'],
    ['upgrade_balance', '💎 Бонусные', '0+'],
    ['parts', '🔧 Запчасти', '0+'],
    ['license_level', '📜 Лицензия', '0+'],
    ['raid_power', '⚔️ Рейд-сила', '0+'],
    ['protection_level', '🛡 Защита', '0+'],
    ['total_income', '📈 Доход всего', 'число'],
    ['turret_level', '🔫 Турель ур.', '0+'],
    ['turret_chance', '🎯 Турель шанс %', 'число']
  ];

  function fieldValue(profile, field) {
    if (field === 'turret_level') return Number(profile?.turret?.level || 0);
    if (field === 'turret_chance') return Number(profile?.turret?.chance || 0);
    return Number(profile?.[field] || 0);
  }

  function buildFieldCard(profile, field, label, hint) {
    const value = fieldValue(profile, field);
    return `<div class="admin-field-card" data-admin-field-card="${field}">
      <label>${label}</label>
      <input type="number" step="1" data-admin-field="${field}" value="${String(value).replace(/"/g, '&quot;')}" />
      <button type="button" data-admin-save-field="${field}">💾 Сохранить</button>
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
    const lvl = Number(profile?.farm?.buildings?.[key] || 0);
    const title = profile?.configs?.buildings?.[key]?.name || key;
    return `<div class="admin-building-card" data-admin-building-card="${key}">
      <label>${title}</label>
      <input type="number" step="1" min="0" data-admin-building="${key}" value="${lvl}" />
      <button type="button" data-admin-save-building="${key}">💾 Сохранить</button>
      <small>ключ: ${key} · сейчас ур. ${fmt(lvl)}</small>
    </div>`;
  }

  function renderUnifiedEditor(profile) {
    const box = document.getElementById('admin-player-info');
    if (!box) return;
    if (!profile) {
      box.innerHTML = '';
      lastProfile = null;
      return;
    }
    lastProfile = profile;
    const login = (profile.login || profile.twitch_login || currentLogin() || DEFAULT_ADMIN_LOGIN).toLowerCase();
    setLogin(login);
    const buildings = knownBuildings(profile);

    box.innerHTML = `<section class="admin-unified-editor">
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
      <div class="admin-unified-grid">
        ${fields.map((f) => buildFieldCard(profile, ...f)).join('')}
      </div>
      <div class="admin-unified-section">
        <h3>🏗 Постройки</h3>
        <div class="admin-buildings-editor-grid">
          ${buildings.length ? buildings.map((key) => buildBuildingCard(profile, key)).join('') : '<p class="admin-muted">Построек и конфигов зданий пока нет.</p>'}
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

  async function saveField(field) {
    const login = currentLogin();
    const input = document.querySelector(`[data-admin-field="${CSS.escape(field)}"]`);
    const value = input ? input.value : '';
    const data = await postAdmin('player/set-field', { login, field, value });
    renderUnifiedEditor(data.profile);
    status('Поле сохранено: ' + field);
  }

  async function saveBuilding(key) {
    const login = currentLogin();
    const input = document.querySelector(`[data-admin-building="${CSS.escape(key)}"]`);
    const level = input ? input.value : '0';
    const data = await postAdmin('player/set-building', { login, building: key, level });
    renderUnifiedEditor(data.profile);
    status('Постройка сохранена: ' + key);
  }

  async function resetCooldown(path, message) {
    const login = currentLogin();
    const data = await postAdmin(path, { login });
    if (data.profile) renderUnifiedEditor(data.profile);
    else await reloadPlayer();
    status(data.message || message);
  }

  function bindUnifiedClicks() {
    const panel = document.getElementById('admin-panel');
    if (!panel || panel.dataset.unifiedEditorReady === '1') return;
    panel.dataset.unifiedEditorReady = '1';

    panel.addEventListener('click', (event) => {
      const saveFieldBtn = event.target.closest('[data-admin-save-field]');
      if (saveFieldBtn) {
        saveField(saveFieldBtn.getAttribute('data-admin-save-field')).catch((e) => status(e.message, true));
        return;
      }

      const saveBuildingBtn = event.target.closest('[data-admin-save-building]');
      if (saveBuildingBtn) {
        saveBuilding(saveBuildingBtn.getAttribute('data-admin-save-building')).catch((e) => status(e.message, true));
        return;
      }

      if (event.target.closest('#admin-unified-refresh')) reloadPlayer('Игрок обновлён').catch((e) => status(e.message, true));
      if (event.target.closest('#admin-unified-reset-case') || event.target.closest('#admin-reset-case-cooldown')) resetCooldown('reset-case-cooldown', 'КД кейса сброшен').catch((e) => status(e.message, true));
      if (event.target.closest('#admin-unified-reset-raid')) resetCooldown('reset-raid-cooldown', 'КД рейда сброшен').catch((e) => status(e.message, true));
      if (event.target.closest('#admin-unified-reset-offcollect') || event.target.closest('#admin-reset-offcollect-cooldown')) resetCooldown('reset-offcollect-cooldown', 'КД оффсбора сброшен').catch((e) => status(e.message, true));

      if (event.target.closest('#admin-reset-gamus-all')) {
        if (!confirm('Сбросить GAMUS всем игрокам?')) return;
        postAdmin('reset-gamus-all', {}).then((d) => status(d.message)).catch((e) => status(e.message, true));
      }
      if (event.target.closest('#admin-reset-case-cooldown-all')) {
        if (!confirm('Сбросить КД кейса всем игрокам?')) return;
        postAdmin('reset-case-cooldown-all', {}).then((d) => status(d.message)).catch((e) => status(e.message, true));
      }
      if (event.target.closest('#admin-reset-raid-cooldown-all')) {
        if (!confirm('Сбросить КД рейда всем игрокам?')) return;
        postAdmin('reset-raid-cooldown-all', {}).then((d) => status(d.message)).catch((e) => status(e.message, true));
      }
      if (event.target.closest('#admin-reset-offcollect-cooldown-all')) {
        if (!confirm('Сбросить КД оффсбора всем игрокам?')) return;
        postAdmin('reset-offcollect-cooldown-all', {}).then((d) => status(d.message)).catch((e) => status(e.message, true));
      }
    });
  }

  function patchRenderer() {
    window.renderAdminPlayer = renderUnifiedEditor;
    try { renderAdminPlayer = renderUnifiedEditor; } catch (_) {}
  }

  function patchLoadButton() {
    const btn = document.getElementById('admin-load-player');
    if (!btn || btn.dataset.unifiedLoadReady === '1') return;
    btn.dataset.unifiedLoadReady = '1';
    btn.addEventListener('click', () => setTimeout(() => reloadPlayer().catch((e) => status(e.message, true)), 0));
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

  function boot() {
    patchRenderer();
    bindUnifiedClicks();
    patchLoadButton();
    loadDefaultAdminPlayer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();
