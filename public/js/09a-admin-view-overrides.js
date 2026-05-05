/* ==========================================================================
   ADMIN VIEW + UI CONTROL PATCH
   - small scroll-to-top button
   - clear player nick button
   - admin "view as player" preview
   - categorized admin advanced menu
   - cleaner event payload rendering
   ========================================================================== */

function installScrollTopButton() {
  if (document.getElementById('scrollTopBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'scrollTopBtn';
  btn.type = 'button';
  btn.title = 'Наверх';
  btn.innerHTML = '↑';
  document.body.appendChild(btn);

  const update = () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  };

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function installAdminLoginClearButton() {
  const input = document.getElementById('admin-login');
  if (!input || input.dataset.clearReady === '1') return;
  input.dataset.clearReady = '1';

  const wrap = document.createElement('div');
  wrap.className = 'admin-login-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const clear = document.createElement('button');
  clear.id = 'admin-clear-login';
  clear.type = 'button';
  clear.title = 'Очистить ник';
  clear.innerHTML = '×';
  wrap.appendChild(clear);

  clear.addEventListener('click', () => {
    input.value = '';
    input.focus();
    const info = document.getElementById('admin-player-info');
    if (info) info.innerHTML = '';
    const suggestions = document.getElementById('admin-player-suggestions');
    if (suggestions) {
      suggestions.innerHTML = '';
      suggestions.classList.add('hidden');
    }
    setAdminStatus?.('Ник очищен. Можно выбрать другого игрока.');
  });
}

function adminProfileViewHtml(profile) {
  const farm = profile.farm || {};
  const resources = farm.resources || {};
  const buildings = farm.buildings || {};
  const configBuildings = profile.configs?.buildings || {};
  const buildingRows = Object.keys(buildings).filter(k => Number(buildings[k] || 0) > 0).map((key) => {
    const conf = configBuildings[key] || {};
    const lvl = Number(buildings[key] || 0);
    const title = conf.name || key;
    const benefit = typeof buildingCardSummary === 'function'
      ? buildingCardSummary(key, conf, lvl)
      : 'улучшает ферму';
    return `<div class="admin-view-building"><b>${title}</b><span>ур. ${stageFormat(lvl)}</span><small>${benefit}</small></div>`;
  }).join('');

  const caseStats = farm.caseStats || {};
  const raidLogs = Array.isArray(farm.raidLogs) ? farm.raidLogs.slice(0, 5) : [];

  return `
    <div class="admin-view-profile">
      <div class="admin-view-hero">
        <div>
          <span>игрок</span>
          <h2>${profile.display_name || profile.twitch_login || profile.login || 'unknown'}</h2>
          <small>@${profile.login || profile.twitch_login || 'unknown'}</small>
        </div>
        <b>ур. ${stageFormat(profile.level || 0)}</b>
      </div>

      <div class="admin-view-grid">
        <div><span>💰 Голда</span><b>${stageFormat(profile.twitch_balance || profile.gold || 0)}</b></div>
        <div><span>🌾 Ферма</span><b>${stageFormat(profile.farm_balance || 0)}</b></div>
        <div><span>💎 Бонусные</span><b>${stageFormat(profile.upgrade_balance || 0)}</b></div>
        <div><span>🔧 Запчасти</span><b>${stageFormat(profile.parts || resources.parts || 0)}</b></div>
        <div><span>⚔️ Рейд-сила</span><b>${stageFormat(profile.raid_power || 0)}</b></div>
        <div><span>🛡 Защита</span><b>${stageFormat(profile.protection_level || 0)}</b></div>
        <div><span>📜 Лицензия</span><b>до ${profile.license_level || 0}</b></div>
        <div><span>🔫 Турель</span><b>${stageFormat(profile.turret?.level || 0)}</b></div>
      </div>

      <div class="admin-view-section">
        <h3>🏗 Постройки</h3>
        <div class="admin-view-buildings">${buildingRows || '<p>Построек нет.</p>'}</div>
      </div>

      <div class="admin-view-section two">
        <div>
          <h3>🎰 Кейсы</h3>
          <p>Открыто: <b>${stageFormat(caseStats.opened || 0)}</b></p>
          <p>Выиграно: <b>${stageFormat(caseStats.coins || 0)}💎 / ${stageFormat(caseStats.parts || 0)}🔧</b></p>
        </div>
        <div>
          <h3>🏴 Последние рейды</h3>
          ${raidLogs.length ? raidLogs.map((r) => `<p>${r.attacker || '—'} → ${r.target || '—'} · ${stageFormat(r.stolen || 0)}💰</p>`).join('') : '<p>Рейдов нет.</p>'}
        </div>
      </div>
    </div>`;
}

async function adminViewPlayerAsProfile() {
  const login = adminLoginValue?.();
  if (!login) {
    setAdminStatus?.('Укажи ник игрока', true);
    return;
  }

  const data = await adminGet(`player/${encodeURIComponent(login)}`);
  unifiedModal(
    '👁 Просмотр профиля игрока',
    `Админ-предпросмотр: как выглядит профиль ${login}`,
    adminProfileViewHtml(data.profile || {}),
    { wide: true }
  );
}

function installAdminViewButton() {
  const load = document.getElementById('admin-load-player');
  if (!load || document.getElementById('admin-view-player-page')) return;

  const btn = document.createElement('button');
  btn.id = 'admin-view-player-page';
  btn.type = 'button';
  btn.className = 'admin-secondary-action';
  btn.textContent = '👁 Смотреть профиль игрока';
  load.insertAdjacentElement('afterend', btn);

  btn.addEventListener('click', () => adminViewPlayerAsProfile().catch((e) => setAdminStatus?.(e.message, true)));
}

function categorizeAdminAdvancedPanel() {
  const panel = document.querySelector('[data-admin-panel="extended"]');
  if (!panel || panel.dataset.categorized === '1') return;

  const grid = panel.querySelector('.admin-grid') || panel;
  const cards = Array.from(grid.children).filter((el) => el.nodeType === 1 && !el.classList.contains('admin-category-group'));
  if (!cards.length) return;

  const groups = [
    { key: 'stream', title: '📡 Стрим и оффсбор', match: /стрим|оффсбор/i },
    { key: 'transfer', title: '🔁 Перенос и синхронизация', match: /перенос|wizebot|урожай|синк|импорт/i },
    { key: 'economy', title: '💰 Экономика и рынок', match: /рынок|долг|баланс|gamus|кейс/i },
    { key: 'tests', title: '🧪 Тесты и чеклисты', match: /рулетка|тест|чеклист/i }
  ];

  const buckets = new Map(groups.map(g => [g.key, []]));
  const misc = [];

  cards.forEach((card) => {
    const txt = card.textContent || '';
    const group = groups.find((g) => g.match.test(txt));
    if (group) buckets.get(group.key).push(card);
    else misc.push(card);
  });

  grid.innerHTML = '';
  groups.forEach((group) => {
    const items = buckets.get(group.key);
    if (!items || !items.length) return;
    const box = document.createElement('section');
    box.className = 'admin-category-group';
    box.innerHTML = `<h3>${group.title}</h3><div class="admin-category-grid"></div>`;
    const inner = box.querySelector('.admin-category-grid');
    items.forEach((card) => inner.appendChild(card));
    grid.appendChild(box);
  });

  if (misc.length) {
    const box = document.createElement('section');
    box.className = 'admin-category-group';
    box.innerHTML = `<h3>🧩 Остальное</h3><div class="admin-category-grid"></div>`;
    const inner = box.querySelector('.admin-category-grid');
    misc.forEach((card) => inner.appendChild(card));
    grid.appendChild(box);
  }

  panel.dataset.categorized = '1';
}

function improveAdminPlayerCard(profile) {
  const box = document.getElementById('admin-player-info');
  if (!box || !profile) return;
  box.innerHTML = `
    <div class="admin-player-card admin-player-card-polished">
      <div class="admin-player-card-head">
        <b>${profile.display_name || profile.twitch_login || profile.login || 'unknown'}</b>
        <button type="button" id="admin-card-view-profile">👁 Профиль</button>
      </div>
      <div class="admin-mini-grid">
        <span>🌾 Ур.</span><b>${stageFormat(profile.level ?? 0)}</b>
        <span>🌾 Ферма</span><b>${stageFormat(profile.farm_balance ?? 0)}</b>
        <span>💎 Бонусные</span><b>${stageFormat(profile.upgrade_balance ?? 0)}</b>
        <span>🔧 Запчасти</span><b>${stageFormat(profile.parts ?? 0)}</b>
        <span>📜 Лицензия</span><b>${stageFormat(profile.license_level ?? 0)}</b>
        <span>⚔️ Рейд-сила</span><b>${stageFormat(profile.raid_power ?? 0)}</b>
        <span>🛡 Защита</span><b>${stageFormat(profile.protection_level ?? 0)}</b>
      </div>
    </div>`;
  document.getElementById('admin-card-view-profile')?.addEventListener('click', () => adminViewPlayerAsProfile().catch((e) => setAdminStatus?.(e.message, true)));
}

// Override old renderer with prettier card.
if (typeof renderAdminPlayer === 'function') {
  renderAdminPlayer = function(profile) {
    if (!profile) {
      const box = document.getElementById('admin-player-info');
      if (box) box.innerHTML = '';
      return;
    }
    improveAdminPlayerCard(profile);
  };
}

function bootAdminViewPatch() {
  installScrollTopButton();
  installAdminLoginClearButton();
  installAdminViewButton();
  categorizeAdminAdvancedPanel();
}

document.addEventListener('DOMContentLoaded', () => {
  bootAdminViewPatch();
  setTimeout(bootAdminViewPatch, 500);
  setTimeout(bootAdminViewPatch, 1500);
});
setInterval(bootAdminViewPatch, 2500);


/* ==========================================================================
   ADMIN SINGLE WINDOW EDITOR FIX
   - backup panel moved into its own admin tab
   - profile preview becomes editable inside same admin window
   - prevents second modal window over admin panel
   ========================================================================== */

function ensureAdminBackupTab() {
  const modal = document.querySelector('#adminModal, .admin-modal, .admin-panel-modal, .admin-modal-polished');
  if (!modal || modal.dataset.backupTabReady === '1') return;

  const tabRow = modal.querySelector('.admin-tabs, .admin-tab-row, [data-admin-tabs]') || modal.querySelector('.admin-panel-tabs') || modal.querySelector('div:has(> button)');
  const panelsParent = modal.querySelector('.admin-panels, .admin-body, .admin-content') || modal;

  // Убираем плавающий внешний Backup / Restore, если он уже был создан
  const floating = document.getElementById('backupPreviewPanel');
  if (floating) floating.remove();

  if (tabRow && !document.getElementById('admin-backup-tab-btn')) {
    const btn = document.createElement('button');
    btn.id = 'admin-backup-tab-btn';
    btn.type = 'button';
    btn.textContent = 'Backup';
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-admin-panel]').forEach(p => p.classList.add('hidden'));
      modal.querySelectorAll('.admin-tabs button, .admin-tab-row button, [data-admin-tabs] button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('admin-backup-panel')?.classList.remove('hidden');
    });
    tabRow.appendChild(btn);
  }

  if (!document.getElementById('admin-backup-panel')) {
    const panel = document.createElement('div');
    panel.id = 'admin-backup-panel';
    panel.setAttribute('data-admin-panel', 'backup');
    panel.className = 'admin-panel hidden';
    panel.innerHTML = `
      <div class="admin-card admin-backup-card-inline">
        <h3>🧯 Backup / Restore</h3>
        <p>Preview перед восстановлением. Выбери backup и блок восстановления.</p>
        <div class="backup-controls inline">
          <button id="backupLoadBtnInline" type="button">Показать backup’и игрока</button>
          <select id="backupBlockSelectInline">
            <option value="all">Всё</option>
            <option value="balances">Балансы</option>
            <option value="progression">Прогресс</option>
            <option value="farm">Ферма</option>
            <option value="buildings">Здания</option>
            <option value="raids">Рейды</option>
            <option value="cases">Кейсы</option>
          </select>
        </div>
        <div id="backupListBoxInline" class="backup-list-box"></div>
      </div>`;
    panelsParent.appendChild(panel);

    document.getElementById('backupLoadBtnInline')?.addEventListener('click', async () => {
      const login = adminLoginValue?.();
      if (!login) return setAdminStatus?.('Укажи игрока', true);
      const data = await adminGet(`backups?login=${encodeURIComponent(login)}`);
      const list = data.backups || [];
      const box = document.getElementById('backupListBoxInline');
      box.innerHTML = list.length ? list.map((b, i)=>`
        <div class="backup-item">
          <b>#${i+1} · ${new Date(b.createdAt || Date.now()).toLocaleString('ru-RU')}</b>
          <small>${b.reason || 'backup'} · уровень ${b.level ?? '—'} · 🌾${stageFormat(b.farm_balance||0)} · 💎${stageFormat(b.upgrade_balance||0)} · 🔧${stageFormat(b.parts||0)}</small>
          <details>
            <summary>Preview</summary>
            <pre class="backup-preview-json">${JSON.stringify(b, null, 2).slice(0, 3500)}</pre>
          </details>
          <button data-backup-restore-inline="${i}" type="button">Восстановить выбранный блок</button>
        </div>`).join('') : '<p>Backup’ов нет.</p>';
      box.querySelectorAll('[data-backup-restore-inline]').forEach(btn=>btn.addEventListener('click', async()=>{
        const index = Number(btn.dataset.backupRestoreInline||0);
        const block = document.getElementById('backupBlockSelectInline')?.value || 'all';
        if (!confirm(`Восстановить backup #${index + 1}, блок: ${block}?`)) return;
        await adminPost('restore-backup-index', { login, index, block });
        setAdminStatus?.('Backup восстановлен');
        await refreshAdminPlayer?.();
      }));
    });
  }

  modal.dataset.backupTabReady = '1';
}

