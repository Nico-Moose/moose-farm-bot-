/* Moose Farm frontend split module: накопленные overrides админ-панели
   Safe-refactor: extracted from public/app.js without logic changes. */
// Soft admin backup preview UI: injects into existing admin modal when available.
function installBackupPreviewPanel() {
  const adminPanel = document.getElementById('admin-panel') || document.querySelector('.admin-panel') || document.querySelector('[data-admin-panel]');
  if (!adminPanel || document.getElementById('backupPreviewPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'backupPreviewPanel';
  panel.className = 'backup-preview-panel';
  panel.innerHTML = `
    <h3>🧯 Backup / Restore</h3>
    <p>Preview перед восстановлением. Можно выбрать блок: всё, балансы, прогресс, ферма, здания, рейды, кейсы.</p>
    <div class="backup-controls">
      <button id="backupLoadBtn">Показать backup’и игрока</button>
      <select id="backupBlockSelect">
        <option value="all">Всё</option>
        <option value="balances">Балансы</option>
        <option value="progression">Прогресс</option>
        <option value="farm">Ферма</option>
        <option value="buildings">Здания</option>
        <option value="raids">Рейды</option>
        <option value="cases">Кейсы</option>
      </select>
    </div>
    <div id="backupListBox" class="backup-list-box"></div>`;
  adminPanel.appendChild(panel);
  document.getElementById('backupLoadBtn')?.addEventListener('click', async () => {
    const login = (document.getElementById('admin-login')?.value || '').trim().toLowerCase();
    if (!login) return setAdminStatus?.('Укажи игрока', true);
    const data = await adminGet(`backups?login=${encodeURIComponent(login)}`);
    const list = data.backups || [];
    const box = document.getElementById('backupListBox');
    box.innerHTML = list.length ? list.map((b, i)=>`
      <div class="backup-item">
        <b>#${i+1} · ${new Date(b.createdAt || Date.now()).toLocaleString('ru-RU')}</b>
        <small>${b.reason || 'backup'} · уровень ${b.level ?? '—'} · 🌾${stageFormat(b.farm_balance||0)} · 💎${stageFormat(b.upgrade_balance||0)} · 🔧${stageFormat(b.parts||0)}</small>
        <button data-backup-restore="${i}">Preview / restore</button>
      </div>`).join('') : '<p>Backup’ов нет.</p>';
    box.querySelectorAll('[data-backup-restore]').forEach(btn=>btn.addEventListener('click', async()=>{
      const index = Number(btn.dataset.backupRestore||0);
      const block = document.getElementById('backupBlockSelect')?.value || 'all';
      const backup = list[index] || {};
      unifiedModal('🧯 Preview восстановления', `Игрок ${login} · блок ${block}`, `<pre class="backup-preview-json">${JSON.stringify(backup, null, 2).slice(0, 6000)}</pre><button id="confirmBackupRestore">Восстановить этот backup</button>`, {wide:true});
      document.getElementById('confirmBackupRestore')?.addEventListener('click', async()=>{
        await adminPost('restore-backup-index', { login, index, block });
        closeUnifiedModal();
        setAdminStatus?.('Backup восстановлен');
        await refreshAdminPlayer?.();
      });
    }));
  });
}

setInterval(installBackupPreviewPanel, 1500);
document.addEventListener('DOMContentLoaded', () => setTimeout(installBackupPreviewPanel, 1000));

function renderEventsList(events) {
  return (events || []).map((e) => `
    <div class="pretty-event-row">
      <b>${normalizedEventTitle(e)}</b>
      <small>${e.created_at || e.timestamp ? new Date(e.created_at || e.timestamp).toLocaleString('ru-RU') : ''}</small>
      <p>${formatEventDetails(e)}</p>
    </div>`).join('');
}


/* ==========================================================================
   NEXT POLISH PATCH: final unified raid/offcollect reports, journal cleanup,
   richer tops and backup blocks.
   ========================================================================== */

function raidBreakdownRows(log = {}) {
  const moneyFromMain = Number(log.money_from_main || log.main_spent || log.from_main || 0);
  const moneyFromFarm = Number(log.money_from_farm || log.farm_spent || log.from_farm || 0);
  const debt = Number(log.debt_after || log.farm_debt || 0);
  const bonus = Number(log.bonus_stolen || 0) + Number(log.turret_bonus || 0);
  const rows = [
    { label: '🎯 Цель', value: String(log.target || '—') },
    { label: '⚔️ Сила атаки', value: `${stageFormat(log.strength || 0)}%` },
    { label: '📈 Базовый доход цели', value: `${stageFormat(log.base_income || 0)}💰` },
    { label: '🛡 Щит заблокировал', value: `${stageFormat(log.blocked || 0)}💰` },
    { label: '💸 Итог монет', value: `${stageFormat(log.stolen || 0)}💰` },
    { label: '💎 Бонусные', value: `${stageFormat(bonus)}💎` },
    { label: '🚨 AFK-множитель', value: `x${Number(log.punish_mult || 1).toFixed(2)}` }
  ];
  if (moneyFromMain) rows.push({ label: '💰 Снято с !money', value: `${stageFormat(moneyFromMain)}💰` });
  if (moneyFromFarm) rows.push({ label: '🌾 Снято с фермы', value: `${stageFormat(moneyFromFarm)}🌾` });
  if (debt < 0) rows.push({ label: '📉 Долг после рейда', value: `${stageFormat(debt)}🌾` });
  if (log.turret_refund) rows.push({ label: '🔫 Турель списала', value: `${stageFormat(log.turret_refund)}💰` });
  if (log.turret_chance || log.turretChance) rows.push({ label: '🎯 Шанс турели', value: `${stageFormat(log.turret_chance || log.turretChance)}%` });
  if (log.jammer_level || log.jammerLevel) rows.push({ label: '📡 Глушилка', value: `-${stageFormat((log.jammer_level || log.jammerLevel) * 5)}%` });
  return rows;
}

async function doRaid() {
  const data = await postJson('/api/farm/raid');
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `рейды доступны с ${data.requiredLevel || 30} уровня фермы`,
      cooldown: `рейд доступен через ${formatTime(data.remainingMs || 0)}`,
      no_targets: 'нет подходящих целей для рейда'
    };
    showMessage(`❌ Рейд не выполнен: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }

  const log = data.log || {};
  const turretBlocked = !!(log.raid_blocked_by_turret || log.killed_by_turret || log.turret_triggered);
  const title = turretBlocked ? `🔫 Рейд отбит турелью` : `🏴‍☠️ Рейд успешен`;
  const subtitle = `${state?.profile?.display_name || state?.profile?.login || 'Игрок'} → ${log.target || 'цель'}`;
  renderActionReport(title, subtitle, raidBreakdownRows(log), { kind: turretBlocked ? 'danger' : 'success', autoCloseMs: 14000 });
  showMessage(turretBlocked ? `🔫 Турель ${log.target} отбила рейд. Списано ${stageFormat(log.turret_refund || 0)}💰` : `🏴‍☠️ Рейд на ${log.target}: +${stageFormat(log.stolen || 0)}💰`);
  await loadMe();
  if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
}

async function offCollect() {
  if (state?.streamOnline || state?.profile?.stream_online) {
    showMessage('⛔ Во время стрима оффсбор недоступен.');
    return;
  }
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  renderUnifiedReward('🌙 Оффсбор получен', '50% от фермы + 50% запчастей завода', [
    { label: '🌾 Ферма', value: `+${stageFormat(data.income || 0)}`, hint: 'зачислено в farm_balance' },
    { label: '🔧 Завод', value: `+${stageFormat(data.partsIncome || 0)}`, hint: 'зачислено в parts' },
    { label: '⏱ Период', value: `${stageFormat(data.minutes || 0)} мин` },
    { label: '📌 Правило', value: 'без бонусных и зданий', hint: 'только ферма и завод / 2' }
  ], { kind: 'success', wide: true });
  await loadMe();
}

function cleanPayloadText(payload) {
  let obj = payload;
  if (typeof payload === 'string') {
    try { obj = JSON.parse(payload); } catch (_) { obj = payload; }
  }
  if (!obj || typeof obj !== 'object') return String(obj || '').replace(/[{}"]/g, '').slice(0, 260);

  const ignore = new Set(['keys','farm_json','farm_v2','farm','payload','configs','configs_json','turret_json']);
  const labels = {
    login: 'игрок', ok: 'статус', action: 'действие', qty: 'кол-во',
    amount: 'сумма', totalCost: 'стоимость', totalParts: 'запчасти',
    building: 'здание', level: 'уровень', oldValue: 'было', newValue: 'стало',
    target: 'цель', attacker: 'атакующий', stolen: 'украдено',
    bonus_stolen: 'бонусные', cost: 'цена', parts: 'детали',
    farm_balance: 'ферма', upgrade_balance: 'бонусные', twitch_balance: 'голда'
  };
  const parts = [];
  Object.keys(obj).forEach((k) => {
    if (ignore.has(k)) return;
    const v = obj[k];
    if (v && typeof v === 'object') return;
    parts.push(`${labels[k] || k}: <b>${String(v)}</b>`);
  });
  return parts.slice(0, 10).join(' · ') || 'событие записано';
}

function prettyEventName(type) {
  type = String(type || '').toLowerCase();
  if (type.includes('market')) return '🏪 Рынок';
  if (type.includes('case')) return '🎰 Кейс';
  if (type.includes('raid')) return '🏴‍☠️ Рейд';
  if (type.includes('turret')) return '🔫 Турель';
  if (type.includes('building')) return '🏗 Здание';
  if (type.includes('license')) return '📜 Лицензия';
  if (type.includes('gamus')) return '🎁 GAMUS';
  if (type.includes('off')) return '🌙 Оффсбор';
  if (type.includes('restore')) return '🧯 Restore';
  if (type.includes('backup')) return '💾 Backup';
  if (type.includes('admin')) return '👑 Админ';
  if (type.includes('sync')) return '🔄 Синхронизация';
  return '📌 Событие';
}

function renderEventsList(events) {
  return (events || []).map((e) => {
    const payload = e.payload || e.details || {};
    const date = e.created_at || e.timestamp || Date.now();
    const login = e.login || payload.login || '';
    return `
      <div class="pretty-event-row event-row-clean">
        <div class="event-title-line"><b>${prettyEventName(e.type)}</b>${login ? `<span>@${login}</span>` : ''}</div>
        <small>${new Date(date).toLocaleString('ru-RU')}</small>
        <p>${cleanPayloadText(payload)}</p>
      </div>`;
  }).join('');
}

function renderTopMiniList(title, arr, valueFn, hintFn) {
  return `<div class="top-card top-card-polished"><b>${title}</b><ol>${arr.length ? arr.map((p, i) => `
    <li><span><em>#${i+1}</em> ${p.nick || p.login || '—'}</span><strong>${valueFn(p)}</strong><small>${hintFn ? hintFn(p) : ''}</small></li>`).join('') : '<li>нет данных</li>'}</ol></div>`;
}

async function loadTops() {
  const topsBox = document.getElementById('topsBox');
  if (!topsBox) return;
  try {
    const res = await fetch('/api/farm/top?days=14');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'top_failed');
    topsBox.dataset.loaded = '1';
    const players = (data.playerTop || []).slice();
    const raids = (data.raidTop || []).slice(0, 10);
    const by = (fn) => players.slice().sort((a,b)=>Number(fn(b)||0)-Number(fn(a)||0)).slice(0,10);

    topsBox.innerHTML = `
      <h3>🏆 Топы и аналитика</h3>
      <div class="analytics-hero-grid">
        ${renderTopMiniList('💰 Богатейшие', by(ordinaryCoins), p=>`${stageFormat(ordinaryCoins(p))}💰`, p=>`ур. ${p.level} · 🌾${stageFormat(farmCoins(p))}`)}
        ${renderTopMiniList('🌾 Ферма', by(farmCoins), p=>`${stageFormat(farmCoins(p))}🌾`, p=>`💎${stageFormat(bonusCoins(p))}`)}
        ${renderTopMiniList('💎 Бонусные', by(bonusCoins), p=>`${stageFormat(bonusCoins(p))}💎`, p=>`🔧${stageFormat(p.parts || 0)}`)}
        ${renderTopMiniList('🔧 Запчасти', by(p=>p.parts), p=>`${stageFormat(p.parts||0)}🔧`, p=>`ур. ${p.level}`)}
        ${renderTopMiniList(`🏴 Рейдеры ${data.days}д`, raids, r=>`${stageFormat(r.money)}💰 / ${stageFormat(r.bonus)}💎`, r=>`${r.attacks}⚔ · ${r.defends}🛡`)}
        ${renderTopMiniList('⚡ Активные', by(p=>p.last_collect_at), p=>p.nick || p.login, p=>p.last_collect_at ? new Date(Number(p.last_collect_at)).toLocaleString('ru-RU') : 'нет сбора')}
      </div>`;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}

function improveAdminEditorVisuals() {
  const modal = document.querySelector('.admin-modal, #adminModal, .admin-panel-modal');
  if (!modal || modal.dataset.polishedAdmin === '1') return;
  modal.dataset.polishedAdmin = '1';
  modal.classList.add('admin-modal-polished');
  const tabs = modal.querySelectorAll('button');
  tabs.forEach((btn) => {
    if (!btn.title) btn.title = 'Админ-действие. Перед опасными изменениями создаётся backup.';
  });
}
setInterval(improveAdminEditorVisuals, 1500);
document.addEventListener('DOMContentLoaded', () => setTimeout(improveAdminEditorVisuals, 1000));


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

function editableProfileField(label, field, value, suffix = '') {
  return `
    <label class="editable-profile-field">
      <span>${label}</span>
      <input data-profile-edit-field="${field}" type="number" value="${Number(value || 0)}" />
      ${suffix ? `<em>${suffix}</em>` : ''}
    </label>`;
}

async function saveEditableProfileField(field, value) {
  const login = adminLoginValue?.();
  if (!login) return setAdminStatus?.('Укажи игрока', true);
  const data = await adminPost('player/set-field', { login, field, value });
  setAdminStatus?.(`Поле ${field} обновлено`);
  if (data.profile) renderAdminEditableProfile(data.profile);
}

function renderAdminEditableProfile(profile) {
  const host = document.getElementById('admin-player-info');
  if (!host || !profile) return;

  const farm = profile.farm || {};
  const resources = farm.resources || {};
  const turret = profile.turret || {};
  const buildings = farm.buildings || {};
  const buildingList = Object.keys(buildings).filter(k => Number(buildings[k] || 0) > 0);

  host.innerHTML = `
    <div class="admin-edit-profile-card">
      <div class="admin-edit-profile-head">
        <div>
          <h3>${profile.display_name || profile.twitch_login || profile.login}</h3>
          <small>@${profile.login || profile.twitch_login}</small>
        </div>
        <button id="admin-refresh-profile-edit" type="button">↻ Обновить</button>
      </div>

      <div class="editable-profile-grid">
        ${editableProfileField('🌾 Уровень', 'level', profile.level)}
        ${editableProfileField('🌾 Ферма', 'farm_balance', profile.farm_balance)}
        ${editableProfileField('💎 Бонусные', 'upgrade_balance', profile.upgrade_balance)}
        ${editableProfileField('🔧 Запчасти', 'parts', profile.parts ?? resources.parts)}
        ${editableProfileField('📜 Лицензия', 'license_level', profile.license_level)}
        ${editableProfileField('⚔️ Рейд-сила', 'raid_power', profile.raid_power)}
        ${editableProfileField('🛡 Защита', 'protection_level', profile.protection_level)}
        ${editableProfileField('🔫 Турель ур.', 'turret_level', turret.level)}
        ${editableProfileField('🎯 Турель шанс', 'turret_chance', turret.chance, '%')}
      </div>

      <div class="admin-edit-actions">
        <button id="admin-save-all-visible-fields" type="button">💾 Сохранить все поля</button>
      </div>

      <div class="admin-edit-section">
        <h4>🏗 Постройки</h4>
        <div class="admin-edit-buildings">
          ${buildingList.length ? buildingList.map(k => `<div><b>${k}</b><span>ур. ${stageFormat(buildings[k])}</span></div>`).join('') : '<p>Построек нет.</p>'}
        </div>
      </div>
    </div>`;

  document.getElementById('admin-refresh-profile-edit')?.addEventListener('click', () => refreshAdminPlayer?.());

  document.getElementById('admin-save-all-visible-fields')?.addEventListener('click', async () => {
    const inputs = Array.from(document.querySelectorAll('[data-profile-edit-field]'));
    for (const input of inputs) {
      await saveEditableProfileField(input.dataset.profileEditField, input.value);
    }
    setAdminStatus?.('Все поля сохранены и применены');
    await refreshAdminPlayer?.();
  });

  document.querySelectorAll('[data-profile-edit-field]').forEach((input) => {
    input.addEventListener('change', async () => {
      await saveEditableProfileField(input.dataset.profileEditField, input.value);
    });
  });
}

// Override old card renderer: now edit profile in the same admin window.
renderAdminPlayer = function(profile) {
  if (!profile) {
    const host = document.getElementById('admin-player-info');
    if (host) host.innerHTML = '';
    return;
  }
  renderAdminEditableProfile(profile);
};

// Override view button: do not open second modal, scroll to editor.
async function adminViewPlayerAsProfile() {
  const login = adminLoginValue?.();
  if (!login) return setAdminStatus?.('Укажи ник игрока', true);
  const data = await adminGet(`player/${encodeURIComponent(login)}`);
  renderAdminEditableProfile(data.profile || {});
  document.getElementById('admin-player-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setAdminStatus?.('Профиль открыт в этом же окне. Поля можно редактировать.');
}

function removeFloatingBackupPanel() {
  const floating = document.getElementById('backupPreviewPanel');
  if (floating) floating.remove();
}

function bootSingleWindowAdminFix() {
  removeFloatingBackupPanel();
  ensureAdminBackupTab();
  installAdminLoginClearButton?.();
  installAdminViewButton?.();
}

document.addEventListener('DOMContentLoaded', () => {
  bootSingleWindowAdminFix();
  setTimeout(bootSingleWindowAdminFix, 700);
  setTimeout(bootSingleWindowAdminFix, 1800);
});
setInterval(bootSingleWindowAdminFix, 2500);
