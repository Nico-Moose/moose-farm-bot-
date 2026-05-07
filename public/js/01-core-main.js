/* Moose Farm frontend split module: общие helpers + главная вкладка
   Safe-refactor: extracted from public/app.js without logic changes. */
let state = null;
const clientPendingPosts = new Set();
let lastMarketQty = Number(localStorage.getItem('mooseFarmLastMarketQty') || '100') || 100;

function setButtonBusy(button, busy) {
  if (!button) return;
  button.disabled = !!busy;
  button.classList.toggle('is-busy', !!busy);
}

function formatNumber(num) {
  num = Number(num) || 0;
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  if (abs >= 1_000_000_000_000) return sign + (abs / 1_000_000_000_000).toFixed(1).replace('.0', '') + 'трлн';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace('.0', '') + 'млрд';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace('.0', '') + 'кк';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1).replace('.0', '') + 'к';

  return sign + String(Math.floor(abs));
}


function casePrizeText(prize) {
  if (!prize) return '—';
  const icon = prize.type === 'parts' ? '🔧' : '💰';
  return '+' + formatNumber(prize.value || 0) + icon;
}

function showCaseOverlay(prize) {
  let overlay = document.getElementById('caseOverlay');
  if (!overlay) return;
  const items = [];
  const base = [
    ['💰','100к'], ['🔧','12.5к'], ['💰','150к'], ['🔧','20к'], ['💰','200к'],
    ['🔧','15к'], ['💰','135к'], ['🔧','17к'], ['💰','180к'], ['🔧','22к']
  ];
  for (let i = 0; i < 45; i++) {
    const x = base[i % base.length];
    items.push('<div class="case-cell"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>');
  }
  items.push('<div class="case-cell case-win"><b>' + (prize?.type === 'parts' ? '🔧' : '💰') + '</b><span>' + formatNumber(prize?.value || 0) + '</span></div>');
  overlay.innerHTML = '<div class="case-overlay-card"><h2>🎰 Кейс открывается</h2><div class="case-roulette"><div class="case-pointer"></div><div class="case-strip">' + items.join('') + '</div></div><div class="case-result">Выигрыш: <b>' + casePrizeText(prize) + '</b></div><button id="caseOverlayClose">Закрыть</button></div>';
  overlay.classList.add('active');
  const close = () => overlay.classList.remove('active');
  document.getElementById('caseOverlayClose')?.addEventListener('click', close);
  setTimeout(() => {
    const title = overlay.querySelector('h2');
    if (title) title.textContent = '🎉 Кейс открыт';
  }, 2200);
  setTimeout(close, 9000);
}

function renderAdminCheckReport(report) {
  if (!report) return '';
  const checks = (report.checks || []).map((c) => '<li><b>' + c.title + '</b>: ' + c.note + '</li>').join('');
  const backups = (report.backups || []).map((b) => new Date(b.createdAt).toLocaleString('ru-RU') + ' — ' + b.reason).join('<br>') || 'нет';
  return '<div class="admin-report"><b>1:1 чеклист для ' + report.login + '</b><ul>' + checks + '</ul><div>Бэкапы:<br>' + backups + '</div></div>';
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const totalMinutes = Math.ceil(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function showMessage(text) {
  const el = document.getElementById('message');
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? 'message-panel' : '';
}

function ensureModalRoot(id, className) {
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    root.className = className || '';
    document.body.appendChild(root);
  }
  return root;
}

function showActionToast(title, lines = [], options = {}) {
  const root = ensureModalRoot('actionToastRoot', 'action-toast-root');
  const toast = document.createElement('div');
  toast.className = 'action-toast ' + (options.kind || '');
  toast.innerHTML = `
    <button class="action-toast-close" type="button">×</button>
    <div class="action-toast-title">${title}</div>
    <div class="action-toast-lines">${lines.map((line) => `<div>${line}</div>`).join('')}</div>
  `;
  root.appendChild(toast);
  const close = () => toast.remove();
  toast.querySelector('.action-toast-close')?.addEventListener('click', close);
  setTimeout(() => toast.classList.add('visible'), 20);
  setTimeout(close, options.timeout || 9000);
}

function showRaidDetails(log = {}) {
  const target = log.target || 'неизвестно';
  const turretBlocked = !!(log.raid_blocked_by_turret || log.killed_by_turret || log.turret_triggered);
  const title = turretBlocked
    ? `🔫 Рейд на ${target}: турель отбила атаку`
    : `🏴 Рейд на ${target}: успех`;
  const lines = [
    `🎯 Цель: <b>${target}</b>`,
    `⚔️ Сила: <b>${formatNumber(log.strength || 0)}%</b> × <b>x${log.punish_mult || 1}</b>`,
    `📈 Базовый доход цели: <b>${formatNumber(log.base_income || 0)}💰</b>`,
    turretBlocked
      ? `🛑 Турель отбила рейд: <b>цель ничего не потеряла</b>`
      : `💸 Украдено монет: <b>${formatNumber(log.stolen || 0)}💰</b>`,
    `💎 Украдено бонусных: <b>${formatNumber((log.bonus_stolen || 0) + (log.turret_bonus || 0))}💎</b>`,
    `🛡 Заблокировано защитой/щитом: <b>${formatNumber(log.blocked || 0)}</b>`,
    `🔫 Шанс турели цели: <b>${formatNumber(log.turret_chance || 0)}%</b>`,
    log.turret_refund ? `💥 С атакующего списано турелью: <b>${formatNumber(log.turret_refund)}💰</b>` : `✅ Турель не сработала`,
    log.ignore_protection ? `⚠️ Защита цели игнорировалась из-за долгой неактивности` : `🛡 Защита цели учитывалась`
  ];
  showActionToast(title, lines, { kind: turretBlocked ? 'danger' : 'raid', timeout: 12000 });
}

function refreshVisibleData() {
  loadMe().catch((err) => console.warn('[REFRESH]', err));
  loadHistory().catch((err) => console.warn('[HISTORY REFRESH]', err));
  if (document.getElementById('admin-panel')?.classList.contains('active')) {
    refreshAdminPlayer().catch(() => {});
    loadAdminEvents().catch(() => {});
  }
}

function ordinaryCoins(profile) {
  return Number(
    profile?.twitch_balance ??
    profile?.twitchBalance ??
    profile?.balance ??
    profile?.gold ??
    0
  ) || 0;
}

function farmCoins(profile) {
  return Number(profile?.farm_balance ?? profile?.farmBalance ?? 0) || 0;
}

function bonusCoins(profile) {
  return Number(profile?.upgrade_balance ?? profile?.upgradeBalance ?? 0) || 0;
}

function currentCoins(profile) {
  return ordinaryCoins(profile) + farmCoins(profile) + bonusCoins(profile);
}

function calcFarmUpgradeCost(level) {
  const lvl = Number(level || 0) || 0;
  if (lvl < 30) return 75 * lvl;
  if (lvl < 60) return (75 * lvl) + 5000 + ((lvl - 30) * 400);
  if (lvl === 60) return (300 * lvl) + 1500;
  if (lvl < 80) return (300 * 60) + 1500 + (lvl - 60) * 500;
  if (lvl === 80) return (300 * 60) + 1500 + (20 * 500) + 2000;
  if (lvl < 100) return (300 * 60) + 1500 + (20 * 500) + 2000 + (lvl - 80) * 1000;
  if (lvl === 100) return (300 * 60) + 1500 + (20 * 500) + 2000 + (20 * 1000) + 1500;
  return (300 * 60) + 1500 + (20 * 500) + 2000 + (20 * 1000) + 2000 + (lvl - 100) * 3000;
}

function getPartsRequiredForLevel(profile, level) {
  const required = profile?.configs?.parts_required || {};
  return Number(required[String(level)] ?? required[level] ?? 0) || 0;
}

function getFarmUpgradePack10(profile) {
  const currentLevel = Number(profile?.level || profile?.farm?.level || 0) || 0;
  let totalCost = 0;
  let totalParts = 0;
  let count = 0;
  for (let i = 1; i <= 10; i++) {
    const lvl = currentLevel + i;
    if (lvl > 300) break;
    totalCost += calcFarmUpgradeCost(lvl);
    totalParts += getPartsRequiredForLevel(profile, lvl);
    count++;
  }
  return { count, cost: totalCost, parts: totalParts };
}

function resourceStatus(profile, needCoins = 0, needParts = 0) {
  const coins = currentCoins(profile);
  const parts = Number(profile?.parts || 0);
  const missingCoins = Math.max(0, Number(needCoins || 0) - coins);
  const missingParts = Math.max(0, Number(needParts || 0) - parts);

  return {
    coins,
    parts,
    missingCoins,
    missingParts,
    coinsOk: missingCoins <= 0,
    partsOk: missingParts <= 0
  };
}

function formatNeedLine(profile, needCoins = 0, needParts = 0) {
  const st = resourceStatus(profile, needCoins, needParts);
  const coinLine = `💰 Сейчас: ${formatNumber(st.coins)} / нужно: ${formatNumber(needCoins)}${st.coinsOk ? ' ✅' : ` ❌ не хватает ${formatNumber(st.missingCoins)}`}`;
  const partsLine = Number(needParts || 0) > 0
    ? `🔧 Сейчас: ${formatNumber(st.parts)} / нужно: ${formatNumber(needParts)}${st.partsOk ? ' ✅' : ` ❌ не хватает ${formatNumber(st.missingParts)}`}`
    : `🔧 Сейчас: ${formatNumber(st.parts)}`;
  return `${coinLine}\n${partsLine}`;
}

function renderQuickStatus(data) {
  const box = document.getElementById('quickStatus');
  if (box) box.remove();
}


function buildingErrorLabel(code, data = {}) {
  const labels = {
    building_not_found: 'здание не найдено в конфиге WizeBot',
    building_already_built: 'здание уже построено',
    building_not_built: 'здание ещё не построено',
    farm_level_too_low: `нужен уровень фермы ${data.requiredLevel || ''}`.trim(),
    not_enough_money: 'не хватает монет',
    not_enough_parts: 'не хватает запчастей',
    max_level: 'достигнут максимум уровня',
    factory_requires_zavod_10: 'для фабрики выше 5 ур. нужен завод 10 ур.',
    mine_requires_zavod_50_factory_50: 'для шахты до 25 ур. нужны завод 50 и фабрика 50',
    mine_requires_zavod_100_factory_100: 'для шахты до 50 ур. нужны завод 100 и фабрика 100',
    mine_requires_zavod_125_factory_125: 'для шахты до 75 ур. нужны завод 125 и фабрика 125',
    mine_requires_zavod_200_factory_200: 'для шахты до 100 ур. нужны завод 200 и фабрика 200',
    mine_requires_zavod_300_factory_300: 'для шахты с 200 ур. нужны завод 300 и фабрика 300'
  };
  return labels[code] || code || 'неизвестная ошибка';
}

function render(data) {
  state = data;

  const el = document.getElementById('profile');
  const p = data.profile;
  const next = data.nextUpgrade;
  const totalCoins = currentCoins(p);
  const twitchCoins = ordinaryCoins(p);
  const syncText = p.last_wizebot_sync_at
    ? new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU')
    : 'ещё не было';
  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) {
    if (data.harvestManagedByWizebot) {
      collectBtn.innerHTML = '🧺 Урожай<br><small>авто через !урожай</small>';
      collectBtn.disabled = false;
      collectBtn.title = 'Урожай собирается автоматически WizeBot-командой !урожай и подтягивается на сайт';
    } else {
      collectBtn.innerHTML = '🧺 Собрать<br><small>60 минут кулдаун</small>';
      collectBtn.disabled = false;
      collectBtn.title = '';
    }
  }
  const avatar = data.user.avatarUrl
    ? `<img class="profile-avatar-big" src="${data.user.avatarUrl}" alt="avatar">`
    : '<div class="profile-avatar-big profile-avatar-fallback">🌾</div>';

  el.innerHTML = `
    <div class="profile-card-final">
        <div class=\"profile-main-left\">
          ${avatar}
          <div>
            <div class="profile-kicker">Игрок</div>
            <div class="profile-name-final">${data.user.displayName}</div>
            <div class="profile-status-pill">${next ? '🌱 Развитие доступно' : '✅ Максимальный уровень'}</div>
          </div>
        </div>

      <div class="profile-stats-final">
        <div class="stat-tile accent"><span>🌾 Уровень</span><b>${p.level}</b></div>
        <div class="stat-tile gold"><span>💰 Голда</span><b>${formatNumber(twitchCoins)}</b></div>
        <div class="stat-tile"><span>🌾 Ферма</span><b>${formatNumber(farmCoins(p))}</b></div>
        <div class="stat-tile"><span>💎 Бонусные</span><b>${formatNumber(bonusCoins(p))}</b></div>
        <div class="stat-tile"><span>💳 Доступно для трат</span><b>${formatNumber(totalCoins)}</b></div>
        <div class="stat-tile"><span>🔧 Запчасти</span><b>${formatNumber(p.parts)}</b></div>
        <div class="stat-tile"><span>📈 Доход/ч</span><b>${formatNumber(data.farmInfo?.hourly?.total || 0)}</b></div>
        <div class="stat-tile"><span>🛡 Защита</span><b>${formatNumber(p.protection_level || 0)}</b></div>
        <div class="stat-tile"><span>⚔️ Рейд-сила</span><b>${formatNumber(p.raid_power || 0)}</b></div>
        <div class="stat-tile"><span>🎟 Лицензия</span><b>до ${p.license_level ? p.license_level : 39}</b></div>
        <div class="stat-tile wide"><span>🔄 WizeBot sync</span><b>${syncText}</b></div>
      </div>
    </div>
  `;

  renderQuickStatus(data);

  const upgrade1Text = document.getElementById('upgrade1Text');
  if (upgrade1Text) {
    upgrade1Text.textContent = next
      ? `${formatNumber(next.cost)} монет${next.parts ? ` / ${formatNumber(next.parts)}🔧` : ''}`
      : 'максимум';
  }

  renderLicense(data);
  renderMarket(data);
  renderCombat(data);
  renderExtras(data);
  renderInfo(data);
  renderBuildings(data);
}

function renderLicense(data) {
  const box = document.getElementById('licenseBox');
  if (!box) return;

  const next = data.nextLicense;
  const p = data.profile;

  if (!next) {
    box.innerHTML = `
      <div class="license-card">
        <h2>🎟 Лицензии</h2>
        <p>✅ Все лицензии куплены. Открыто до 120 уровня.</p>
      </div>
    `;
    return;
  }

  const st = resourceStatus(p, next.cost, 0);
  box.innerHTML = `
    <div class="license-card">
      <h2>🎟 Лицензии</h2>
      <p>Сейчас открыто до: <b>${p.license_level ? p.license_level : 39}</b> уровня</p>
      <p>Следующая лицензия: <b>${next.level}</b> уровень</p>
      <p>Цена: <b>${formatNumber(next.cost)}💰</b></p>
      <p class="resource-line">У тебя: <b>${formatNumber(st.coins)}💰</b>${st.coinsOk ? ' ✅' : ` ❌ не хватает ${formatNumber(st.missingCoins)}💰`}</p>
      <button id="buyLicenseBtn">🎟 Купить лицензию до ${next.level}</button>
    </div>
  `;

  document.getElementById('buyLicenseBtn').addEventListener('click', buyLicense);
}
