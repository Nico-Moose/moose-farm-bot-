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
  let box = document.getElementById('quickStatus');
  const profile = data.profile;
  const next = data.nextUpgrade;

  if (!box) {
    box = document.createElement('section');
    box.id = 'quickStatus';
    box.className = 'quick-status';
    const profileEl = document.getElementById('profile');
    profileEl?.insertAdjacentElement('afterend', box);
  }

  const coins = currentCoins(profile);
  const twitchCoins = ordinaryCoins(profile);
  const parts = Number(profile.parts || 0);
  let upgradeText = '✅ Ферма уже на максимальном уровне';

  if (next) {
    const st = resourceStatus(profile, next.cost, next.parts);
    const missing = [];
    if (!st.coinsOk) missing.push(`💰 ${formatNumber(st.missingCoins)}`);
    if (!st.partsOk) missing.push(`🔧 ${formatNumber(st.missingParts)}`);
    upgradeText = missing.length
      ? `⬆️ Следующий ап: нужно ${formatNumber(next.cost)}💰${next.parts ? ` и ${formatNumber(next.parts)}🔧` : ''}. Не хватает: ${missing.join(' / ')}`
      : `⬆️ Следующий ап доступен: ${formatNumber(next.cost)}💰${next.parts ? ` / ${formatNumber(next.parts)}🔧` : ''}`;
  }

  box.innerHTML = `
    <div><b>Текущие ресурсы</b></div>
    <div class="quick-status-grid">
      <span>💰 Голда: <b>${formatNumber(twitchCoins)}</b></span>
      <span>🌾 Ферма: <b>${formatNumber(farmCoins(profile))}</b></span>
      <span>💎 Бонусные: <b>${formatNumber(bonusCoins(profile))}</b></span>
      <span>💳 Доступно для трат: <b>${formatNumber(coins)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="quick-status-upgrade">${upgradeText}</div>
  `;
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
      <div class="profile-main-left">
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

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;

  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const canBuyOne = stock > 0 && upgradeBalance >= buyPrice;
  const canSellOne = parts > 0;
  const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));

  box.innerHTML = `
    <div class="market-hero">
      <div class="market-stat"><span>📦 Склад</span><b>${formatNumber(stock)}🔧</b></div>
      <div class="market-stat"><span>🔵 Купить</span><b>1🔧 = ${formatNumber(buyPrice)}💎</b></div>
      <div class="market-stat"><span>🟢 Продать</span><b>1🔧 = ${formatNumber(sellPrice)}💎</b></div>
      <div class="market-stat"><span>Твой лимит покупки</span><b>${formatNumber(maxBuy)}🔧</b></div>
    </div>
    <div class="market-wallet">
      <span>💎 Ап-баланс: <b>${formatNumber(upgradeBalance)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="market-actions pretty-actions">
      <input id="marketQty" type="number" min="1" step="1" value="${lastMarketQty}" />
      <button id="marketBuyBtn" ${!canBuyOne ? 'disabled' : ''}>🔵 Купить запчасти</button>
      <button id="marketSellBtn" ${!canSellOne ? 'disabled' : ''}>🟢 Продать запчасти</button>
    </div>
    <p class="market-hint">${canBuyOne ? 'Покупка списывает 💎 и выдаёт 🔧.' : 'Для покупки нужны 💎 и склад рынка.'} ${canSellOne ? 'Продажа выдаёт 💎.' : 'Для продажи нужны 🔧.'}</p>
  `;

  const qtyInput = document.getElementById('marketQty');
  qtyInput?.addEventListener('input', () => {
    const value = Math.max(1, Number(qtyInput.value || 1));
    lastMarketQty = value;
    localStorage.setItem('mooseFarmLastMarketQty', String(value));
  });
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;

  const p = data.profile || {};
  const configs = p.configs || {};
  const buildingsConfig = configs.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);

  if (!keys.length) {
    el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>';
    return;
  }

  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0);
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const buyCoins = Number(conf.baseCost || 0);
    const buyParts = Number(conf.partsBase || 0);
    const nextLevel = lvl + 1;
    const upgradeCoins = buyCoins + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
    const upgradeParts = buyParts + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    const shownCoins = isBuilt ? upgradeCoins : buyCoins;
    const shownParts = isBuilt ? upgradeParts : buyParts;
    const st = resourceStatus(p, shownCoins, shownParts);
    const shortage = [];
    if (!st.coinsOk) shortage.push(`💰 не хватает ${formatNumber(st.missingCoins)}`);
    if (!st.partsOk) shortage.push(`🔧 не хватает ${formatNumber(st.missingParts)}`);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const cardClass = levelLocked ? 'building-card locked-building' : shortage.length ? 'building-card shortage-building' : 'building-card ready-building';
    const subtitle = levelLocked
      ? `🔒 Нужен уровень фермы ${requiredLevel}. Сейчас ${farmLevel}.`
      : isBuilt
        ? (maxed ? '✅ Максимальный уровень' : `Следующий ап до ${nextLevel} ур.`)
        : 'Можно построить';

    return `
      <div class="${cardClass}">
        <div class="building-title-row">
          <h3>${conf.name || key}</h3>
          <span class="building-badge">${isBuilt ? 'ур. ' + lvl + (maxLevel ? '/' + maxLevel : '') : 'не построено'}</span>
        </div>
        <p class="building-subtitle">${subtitle}</p>
        <div class="building-cost-box">
          <span>Цена</span>
          <b>${formatNumber(shownCoins)}💰</b>
          <b>${formatNumber(shownParts)}🔧</b>
        </div>
        <div class="building-wallet-box">
          <span>У тебя</span>
          <b>${formatNumber(st.coins)}💰</b>
          <b>${formatNumber(st.parts)}🔧</b>
        </div>
        ${levelLocked ? `<p class="shortage">Недоступно: нужен ${requiredLevel} уровень фермы</p>` : ''}
        ${!levelLocked && shortage.length ? `<p class="shortage">${shortage.join(' · ')}</p>` : ''}
        ${!levelLocked && !shortage.length && !maxed ? '<p class="okline">Ресурсов хватает ✅</p>' : ''}
        ${!isBuilt
          ? `<button data-building-buy="${key}" data-required-level="${requiredLevel}" ${levelLocked ? 'disabled' : ''}>🏗 Купить</button>`
          : `
            <div class="building-actions">
              <button data-building-upgrade="${key}" data-count="1" ${maxed ? 'disabled' : ''}>⬆️ Ап +1</button>
              <button data-building-upgrade="${key}" data-count="10" ${maxed ? 'disabled' : ''}>⬆️ Ап +10</button>
            </div>
          `}
      </div>
    `;
  }).join('');

  document.querySelectorAll('[data-building-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const required = Number(btn.getAttribute('data-required-level') || 0);
      const current = Number(state?.profile?.level || 0);
      if (current < required) {
        showMessage(`⛔ Здание пока недоступно: нужен уровень фермы ${required}, сейчас ${current}.`);
        return;
      }
      await buyBuilding(btn.getAttribute('data-building-buy'));
    });
  });

  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await upgradeBuilding(
        btn.getAttribute('data-building-upgrade'),
        Number(btn.getAttribute('data-count') || 1)
      );
    });
  });
}

async function loadMe() {
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      location.href = '/';
      return;
    }

    let data = await res.json();

    // ВАЖНО: при обновлении страницы НЕ делаем WizeBot API sync.
    // Страница читает локальную SQLite-базу.
    // WizeBot обновляется вручную через !синкферма / LongText bridge.

    render(data);
    loadHistory().catch((err) => console.warn('[HISTORY]', err));
  } catch (error) {
    document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
    console.error(error);
  }
}

async function postJson(url, body = {}) {
  const lockKey = url + ':' + JSON.stringify(body || {});
  if (clientPendingPosts.has(lockKey)) {
    return { ok: false, error: 'action_in_progress', message: 'Действие уже выполняется' };
  }

  clientPendingPosts.add(lockKey);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { ok: false, error: 'bad_json_response', raw: text };
    }

    if (!res.ok && data.ok !== false) {
      data.ok = false;
      data.error = `http_${res.status}`;
    }

    return data;
  } finally {
    clientPendingPosts.delete(lockKey);
  }
}

async function buyLicense() {
  const data = await postJson('/api/farm/license/buy');

  if (!data.ok) {
    if (data.error === 'not_enough_money') {
      const p = data.profile || state?.profile || {};
      showMessage(`⛔ Не хватает монет на лицензию.\n${formatNeedLine(p, data.needed || data.cost || 0, 0)}`);
    } else if (data.error === 'all_licenses_bought') {
      showMessage('✅ Все лицензии уже куплены.');
    } else {
      showMessage(`❌ Ошибка лицензии: ${data.error}`);
    }
    await loadMe();
    return;
  }

  showMessage(`🎟 Куплена лицензия до ${data.licenseLevel} уровня за ${formatNumber(data.cost)}💰`);
  await loadMe();
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty');
  const qty = Number(qtyInput?.value || 0);
  if (qty > 0) {
    lastMarketQty = qty;
    localStorage.setItem('mooseFarmLastMarketQty', String(qty));
  }
  const data = await postJson(`/api/farm/market/${action}`, { qty });

  if (!data.ok) {
    const labels = {
      invalid_quantity: 'укажи количество больше 0',
      quantity_too_large: `слишком большое число, максимум ${formatNumber(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: ${formatNumber(data.available || 0)}/${formatNumber(data.needed || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎 ап-баланса: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`,
      market_stock_empty: 'склад рынка пуст',
      not_enough_market_stock: 'на складе рынка недостаточно запчастей'
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }

  if (action === 'buy') {
    showMessage(`🔵 Куплено ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
    showActionToast('🏪 Покупка на рынке', [
      `Куплено: <b>${formatNumber(data.qty)}🔧</b>`,
      `Потрачено: <b>${formatNumber(data.totalCost)}💎</b>`,
      `Склад после сделки: <b>${formatNumber(data.market?.stock ?? 0)}🔧</b>`,
      `Следующее количество сохранено: <b>${formatNumber(lastMarketQty)}🔧</b>`
    ], { kind: 'market' });
  } else {
    showMessage(`🟢 Продано ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎`);
    showActionToast('🏪 Продажа на рынке', [
      `Продано: <b>${formatNumber(data.qty)}🔧</b>`,
      `Получено: <b>${formatNumber(data.totalCost)}💎</b>`,
      `Склад после сделки: <b>${formatNumber(data.market?.stock ?? 0)}🔧</b>`,
      `Следующее количество сохранено: <b>${formatNumber(lastMarketQty)}🔧</b>`
    ], { kind: 'market' });
  }

  await loadMe();
}

async function buyBuilding(key) {
  const data = await postJson('/api/farm/building/buy', { key });

  if (!data.ok) {
    const p = data.profile || state?.profile || {};
    const b = (data.buildings || []).find((item) => item.key === key);
    const needCoins = Number(data.totalCost || b?.buyCost?.coins || 0);
    const needParts = Number(data.totalParts || b?.buyCost?.parts || 0);
    const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
    showMessage(`❌ Здание не куплено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
    await loadMe();
    return;
  }

  showMessage(`✅ Куплено: ${data.name || data.building}. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

async function upgradeBuilding(key, count) {
  const data = await postJson('/api/farm/building/upgrade', { key, count });

  if (!data.ok) {
    const p = data.profile || state?.profile || {};
    const b = (data.buildings || []).find((item) => item.key === key);
    const needCoins = Number(b?.upgradeCost?.coins || data.nextCost || 0);
    const needParts = Number(b?.upgradeCost?.parts || data.nextParts || 0);
    const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
    showMessage(`❌ Здание не улучшено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
    await loadMe();
    return;
  }

  showMessage(`⬆️ ${data.name || data.building}: +${data.upgraded} ур. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

function farmUpgradeErrorMessage(data) {
  if (data.stopReason === 'license_required' || data.error === 'license_required') {
    const req = data.requiredLicense;
    return req
      ? `🎟 Нужна лицензия до ${req.level} уровня. Цена: ${formatNumber(req.cost)}💰`
      : '🎟 Нужна лицензия для следующего уровня.';
  }

  const p = data.profile || state?.profile || {};
  const next = data.nextUpgrade || state?.nextUpgrade;
  const reason = data.stopReason || data.error || 'не хватает ресурсов';
  const label = reason === 'not_enough_money' ? 'не хватает монет' : reason === 'not_enough_parts' ? 'не хватает запчастей' : reason;
  const details = next ? `\n${formatNeedLine(p, next.cost, next.parts)}` : '';
  return `⛔ Не удалось улучшить ферму: ${label}${details}`;
}

document.getElementById('collectBtn').addEventListener('click', async () => {
  if (state?.harvestManagedByWizebot) {
    showMessage('🌾 Урожай собирается автоматически командой !урожай в WizeBot и сам подтягивается на сайт.');
    return;
  }

  const data = await postJson('/api/farm/collect');

  if (!data.ok && data.error === 'harvest_managed_by_wizebot') {
    showMessage(data.message || '🌾 Урожай собирается автоматически через WizeBot.');
    await loadMe();
    return;
  }

  if (!data.ok && data.error === 'cooldown') {
    showMessage(`⏳ Сбор будет доступен через ${formatTime(data.remainingMs)}`);
    await loadMe();
    return;
  }

  showMessage(`✅ Собрано: ${formatNumber(data.income)} монет${data.partsIncome ? ` и ${formatNumber(data.partsIncome)}🔧` : ''} за ${data.minutes} мин.`);
  await loadMe();
});

document.getElementById('upgrade1Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 1 });

  if (!data.ok) {
    showMessage(farmUpgradeErrorMessage(data));
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('upgrade10Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 10 });

  if (!data.ok) {
    showMessage(farmUpgradeErrorMessage(data));
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('syncWizebotBtn').addEventListener('click', async () => {
  showMessage('🔄 Синхронизация запускается через команду !синкферма в Twitch-чате.');
});

function openFarmTab(name) {
  const target = name || 'main';
  document.querySelectorAll('.farm-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.getAttribute('data-farm-panel') === target);
  });
  document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-farm-tab') === target && btn.classList.contains('farm-tab'));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initVisualPanels() {
  document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openFarmTab(btn.getAttribute('data-farm-tab')));
  });
}

initVisualPanels();

loadMe();

function renderCombat(data) {
  const box = document.getElementById('combatBox');
  if (!box) return;

  const p = data.profile || {};
  const raidPower = data.raidUpgrades?.raidPower || {};
  const protection = data.raidUpgrades?.protection || {};
  const turret = data.turret || {};
  const raid = data.raid || {};
  const raidReady = !raid.remainingMs;

  const raidPowerNeed = Number(raidPower.nextCost || 0);
  const protectionNeed = Number(protection.nextCost || 0);
  const turretNeed = turret.nextUpgrade || null;

  box.innerHTML = `
    <div class="combat-card">
      <h3>⚔️ Рейд-сила</h3>
      <p>Уровень: <b>${formatNumber(raidPower.level || 0)}/${formatNumber(raidPower.maxLevel || 200)}</b></p>
      <p>Цена следующего: <b>${raidPowerNeed ? formatNumber(raidPowerNeed) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b>${raidPowerNeed && (p.upgrade_balance || 0) < raidPowerNeed ? ` ❌ не хватает ${formatNumber(raidPowerNeed - (p.upgrade_balance || 0))}💎` : ' ✅'}</p>
      <div class="building-actions">
        <button data-raid-power="1" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +1</button>
        <button data-raid-power="10" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +10</button>
      </div>
      ${!raidPower.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>

    <div class="combat-card">
      <h3>🛡 Защита</h3>
      <p>Уровень: <b>${formatNumber(protection.level || 0)}/${formatNumber(protection.maxLevel || 120)}</b> (${Number(protection.percent || 0).toFixed(1)}%)</p>
      <p>Цена следующего: <b>${protectionNeed ? formatNumber(protectionNeed) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b>${protectionNeed && (p.upgrade_balance || 0) < protectionNeed ? ` ❌ не хватает ${formatNumber(protectionNeed - (p.upgrade_balance || 0))}💎` : ' ✅'}</p>
      <div class="building-actions">
        <button data-protection="1" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +1</button>
        <button data-protection="10" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +10</button>
      </div>
      ${!protection.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>

    <div class="combat-card">
      <h3>🔫 Турель</h3>
      <p>Уровень: <b>${formatNumber(turret.level || 0)}/${formatNumber(turret.maxLevel || 20)}</b> | шанс: <b>${formatNumber(turret.chance || 0)}%</b></p>
      ${turretNeed ? `<p>Следующий: <b>${formatNumber(turretNeed.chance)}%</b> за <b>${formatNumber(turretNeed.cost)}💰</b> / <b>${formatNumber(turretNeed.parts)}🔧</b></p>` : '<p>✅ Максимальный уровень</p>'}
      ${turretNeed ? `<p class="resource-line">У тебя: <b>${formatNumber(currentCoins(p))}💰</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>` : ''}
      ${turretNeed ? '<button id="turretUpgradeBtn">🔫 Улучшить турель</button>' : ''}
    </div>

    <div class="combat-card">
      <h3>🏴 Рейд</h3>
      <p>Доступ: <b>${raid.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Кулдаун: <b>${raidReady ? 'готово ✅' : formatTime(raid.remainingMs)}</b></p>
      <button id="raidBtn" ${!raid.unlocked || !raidReady ? 'disabled' : ''}>🏴 Совершить рейд</button>
      <p class="muted">Цель выбирается автоматически. Чаще попадаются богатые фермы.</p>
    </div>
  `;

  document.querySelectorAll('[data-raid-power]').forEach((btn) => btn.addEventListener('click', () => upgradeRaidPower(Number(btn.dataset.raidPower || 1))));
  document.querySelectorAll('[data-protection]').forEach((btn) => btn.addEventListener('click', () => upgradeProtection(Number(btn.dataset.protection || 1))));
  document.getElementById('turretUpgradeBtn')?.addEventListener('click', upgradeTurret);
  document.getElementById('raidBtn')?.addEventListener('click', doRaid);
}

async function upgradeRaidPower(count) {
  const data = await postJson('/api/farm/raid-power/upgrade', { count });
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `доступно с ${data.requiredLevel || 120} уровня фермы`,
      max_level: 'рейд-сила уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Рейд-сила не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`⚔️ Рейд-сила +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
  await loadMe();
}

async function upgradeProtection(count) {
  const data = await postJson('/api/farm/protection/upgrade', { count });
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `доступно с ${data.requiredLevel || 120} уровня фермы`,
      max_level: 'защита уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Защита не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🛡 Защита +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
  await loadMe();
}

async function upgradeTurret() {
  const data = await postJson('/api/farm/turret/upgrade');
  if (!data.ok) {
    const labels = {
      max_level: 'турель уже максимальная',
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`,
      not_enough_parts: `не хватает запчастей: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Турель не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🔫 Турель улучшена до ${data.level} ур. Потрачено ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
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
  if (turretBlocked) {
    showMessage(`🔫 Рейд на ${log.target} отбит турелью: цель не потеряла монеты | с атакующего списано ${formatNumber(log.turret_refund || 0)}💰 | сила ${formatNumber(log.strength)}% x${log.punish_mult}`);
  } else {
    showMessage(`🏴 Рейд на ${log.target}: украдено ${formatNumber(log.stolen)}💰 | сила ${formatNumber(log.strength)}% x${log.punish_mult} | блок ${formatNumber(log.blocked)}🛡`);
  }
  showRaidDetails(log);
  await loadMe();
  if (document.querySelector('[data-farm-panel="info"]')?.classList.contains('active')) {
    await loadTops();
  }
}

function prizeLabel(prize) {
  if (!prize) return '';
  const icon = prize.type === 'parts' ? '🔧' : '💎';
  return formatNumber(prize.value) + icon + ' x' + Number(prize.multiplier || 1).toFixed(2);
}

function renderExtras(data) {
  const box = document.getElementById('extrasBox');
  if (!box) return;
  const p = data.profile || {};
  const cs = data.caseStatus || {};
  const gamus = data.gamus || {};
  const ranges = gamus.ranges || {};

  const lastCases = (cs.history || []).slice(0, 5).map((h) => `<li>${new Date(h.date).toLocaleString('ru-RU')} — ${prizeLabel(h)} за ${formatNumber(h.cost)}💰</li>`).join('') || '<li>История пока пустая</li>';

  box.innerHTML = `
    <div class="combat-card">
      <h3>🎰 Кейс</h3>
      <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Цена: <b>${formatNumber(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
      <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
      <button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button>
      <details><summary>Последние кейсы</summary><ol>${lastCases}</ol></details>
    </div>

    <div class="combat-card">
      <h3>🧠 GAMUS</h3>
      <p>Тир: <b>${formatNumber(ranges.tierLevel || 0)}</b> | шахта: <b>${formatNumber(ranges.mineLevel || 0)}</b></p>
      <p>Награда: <b>${formatNumber(ranges.minMoney || 0)}-${formatNumber(ranges.maxMoney || 0)}💎</b> / <b>${formatNumber(ranges.minParts || 0)}-${formatNumber(ranges.maxParts || 0)}🔧</b></p>
      <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
      <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
    </div>

    <div class="combat-card">
      <h3>🌙 Оффсбор</h3>
      <p>Урезанный сбор 50% как в WizeBot.</p>
      <p>Баланс сейчас: <b>${formatNumber(p.farm_balance || 0)}🌾</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>
      <button id="offCollectBtn">🌙 Оффсбор</button>
    </div>
  `;

  document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
  document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
  document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
}

function renderInfo(data) {
  const infoBox = document.getElementById('infoBox');
  const topsBox = document.getElementById('topsBox');
  if (!infoBox) return;
  const info = data.farmInfo || {};
  const raidInfo = data.raidInfo || {};
  const hourly = info.hourly || {};
  const balances = info.balances || {};
  const buildings = info.buildings || [];
  const raidLogs = (raidInfo.logs || []).slice(0, 8);

  infoBox.innerHTML = `
    <div class="info-grid">
      <div class="info-metric"><span>💰 Обычные</span><b>${formatNumber(balances.twitch || 0)}</b><small>монеты Twitch / !мани</small></div>
      <div class="info-metric"><span>🌾 Ферма</span><b>${formatNumber(balances.farm || 0)}</b><small>вирт. монеты фермы</small></div>
      <div class="info-metric"><span>💎 Ап-баланс</span><b>${formatNumber(balances.upgrade || 0)}</b><small>бонусные</small></div>
      <div class="info-metric"><span>🔧 Запчасти</span><b>${formatNumber(balances.parts || 0)}</b><small>детали</small></div>
      <div class="info-metric"><span>📈 Доход/ч</span><b>${formatNumber(hourly.total || 0)}</b><small>пассив ${formatNumber(hourly.passive || 0)} · урожай ${formatNumber((hourly.plants || 0) + (hourly.animals || 0))} · здания ${formatNumber(hourly.buildingCoins || 0)}</small></div>
      <div class="info-metric"><span>🏗 Здания</span><b>${buildings.length}</b><small>${buildings.length ? buildings.map((b) => `${b.config?.name || b.key}: ${b.level}`).join(' · ') : 'нет'}</small></div>
      <div class="info-metric"><span>🏴 Рейды за 14д</span><b>${formatNumber(raidInfo.twoWeeks?.count || 0)} шт.</b><small>${formatNumber(raidInfo.twoWeeks?.stolen || 0)}💰 · ${formatNumber(raidInfo.twoWeeks?.bonus || 0)}💎</small></div>
    </div>
    <details open><summary>Последние рейды</summary>
      <ol>${raidLogs.length ? raidLogs.map((r) => `<li>${new Date(r.timestamp).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: ${formatNumber(r.stolen)}💰, ${formatNumber(r.bonus_stolen || 0)}💎</li>`).join('') : '<li>Рейдов пока нет</li>'}</ol>
    </details>
    <button id="refreshTopBtn">🏆 Обновить топы</button>
  `;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
  if (topsBox && !topsBox.dataset.loaded) loadTops();
}

async function openCase() {
  const data = await postJson('/api/farm/case/open');
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
      cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showCaseOverlay(data.prize);
  showMessage(`🎰 Кейс: выигрыш ${prizeLabel(data.prize)}. Цена ${formatNumber(data.cost)}💰`);
  await loadMe();
}

async function claimGamus() {
  const data = await postJson('/api/farm/gamus/claim');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ GAMUS будет доступен через ${formatTime(data.remainingMs || 0)} (06:00 МСК)` : `❌ GAMUS: ${data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🎁 GAMUS: +${formatNumber(data.money)}💎 и +${formatNumber(data.parts)}🔧 (тир ${data.tierLevel})`);
  await loadMe();
}

async function offCollect() {
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}💰${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
  await loadMe();
}

async function loadTops() {
  const topsBox = document.getElementById('topsBox');
  if (!topsBox) return;
  try {
    const res = await fetch('/api/farm/top?days=14');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'top_failed');
    topsBox.dataset.loaded = '1';
    const raids = (data.raidTop || []).slice(0, 10);
    const players = (data.playerTop || []).slice(0, 10);
    topsBox.innerHTML = `
      <h3>🏆 Топы</h3>
      <div class="tops-grid pretty-tops">
        <div class="top-card"><b>🏴 Топ рейдов за ${data.days}д</b><ol>${raids.length ? raids.map((r) => `<li><span>${r.nick}</span><strong>${formatNumber(r.money)}💰 / ${formatNumber(r.bonus)}💎</strong><em>${r.attacks}⚔ · ${r.defends}🛡</em></li>`).join('') : '<li>нет рейдов</li>'}</ol></div>
        <div class="top-card"><b>💰 Топ игроков</b><ol>${players.length ? players.map((p) => `<li><span>${p.nick}</span><strong>💰${formatNumber(ordinaryCoins(p))} / 🌾${formatNumber(farmCoins(p))} / 💎${formatNumber(bonusCoins(p))}</strong><em>ур. ${p.level} · 🔧${formatNumber(p.parts)}</em></li>`).join('') : '<li>нет игроков</li>'}</ol></div>
      </div>
    `;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}
function isAdminUser(user) {
  const login = (
    user?.login ||
    user?.twitch_login ||
    user?.username ||
    user?.name ||
    ""
  ).toLowerCase();

  return login === "nico_moose";
}

function adminLoginValue() {
  return document.getElementById("admin-login")?.value?.trim()?.toLowerCase();
}

function setAdminStatus(message, isError = false) {
  const box = document.getElementById("admin-status");
  if (!box) return;

  box.textContent = message || "";
  box.classList.toggle("error", !!isError);
}

async function adminPost(path, body) {
  const adminPostLockKey = path + ':' + JSON.stringify(body || {});
  if (clientPendingPosts.has(adminPostLockKey)) {
    throw new Error('Действие уже выполняется. Подожди завершения предыдущего клика.');
  }

  clientPendingPosts.add(adminPostLockKey);
  try {
    const res = await fetch(`/api/admin/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body || {}),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Ошибка админ-действия");
    }

    setTimeout(refreshVisibleData, 60);

    return data;
  } finally {
    clientPendingPosts.delete(adminPostLockKey);
  }
}

async function adminGet(path) {
  const res = await fetch(`/api/admin/${path}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Ошибка загрузки");
  }

  return data;
}

function renderAdminPlayer(profile) {
  const box = document.getElementById("admin-player-info");
  if (!box) return;

  if (!profile) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div class="admin-player-card">
      <b>${profile.twitch_login || profile.login || "unknown"}</b>
      <div>🌾 Уровень: ${profile.level ?? 0}</div>
      <div>💰 Фермерский баланс: ${profile.farm_balance ?? 0}</div>
      <div>💎 Бонусный баланс: ${profile.upgrade_balance ?? 0}</div>
      <div>🔧 Запчасти: ${profile.parts ?? 0}</div>
      <div>📜 Лицензия: ${profile.license_level ?? 0}</div>
      <div>⚔️ Рейд-сила: ${profile.raid_power ?? 0}</div>
      <div>🛡 Защита: ${profile.protection_level ?? 0}</div>
    </div>
  `;
}

async function refreshAdminPlayer() {
  const login = adminLoginValue();
  if (!login) {
    setAdminStatus("Укажи ник игрока", true);
    return;
  }

  const data = await adminGet(`player/${encodeURIComponent(login)}`);
  renderAdminPlayer(data.profile);
  setAdminStatus("Игрок загружен");
}

function bindAdminPanel() {
  const panel = document.getElementById("admin-panel");
  if (!panel) return;

  const loginOrError = () => {
    const login = adminLoginValue();
    if (!login) {
      setAdminStatus("Укажи ник игрока", true);
      return null;
    }
    return login;
  };

  document.getElementById("admin-load-player")?.addEventListener("click", async () => {
    try {
      await refreshAdminPlayer();
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-give-farm")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const amount = document.getElementById("admin-farm-amount").value;
      const data = await adminPost("give-farm-balance", { login, amount });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-give-upgrade")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const amount = document.getElementById("admin-upgrade-amount").value;
      const data = await adminPost("give-upgrade-balance", { login, amount });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-give-parts")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const amount = document.getElementById("admin-parts-amount").value;
      const data = await adminPost("give-parts", { login, amount });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-set-level")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const level = document.getElementById("admin-level").value;
      const data = await adminPost("set-level", { login, level });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-set-protection")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const level = document.getElementById("admin-protection").value;
      const data = await adminPost("set-protection", { login, level });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-set-raid-power")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const level = document.getElementById("admin-raid-power").value;
      const data = await adminPost("set-raid-power", { login, level });

      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-reset-raid")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      const data = await adminPost("reset-raid-cooldown", { login });
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-delete-buildings")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      if (!confirm(`Удалить все постройки у ${login}?`)) return;

      const data = await adminPost("delete-buildings", { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });

  document.getElementById("admin-delete-farm")?.addEventListener("click", async () => {
    try {
      const login = loginOrError();
      if (!login) return;

      if (!confirm(`ПОЛНОСТЬЮ удалить ферму ${login}?`)) return;
      if (!confirm(`Точно удалить? Это действие нельзя отменить.`)) return;

      const data = await adminPost("delete-farm", { login });
      renderAdminPlayer(null);
      setAdminStatus(data.message);
    } catch (e) {
      setAdminStatus(e.message, true);
    }
  });
}


function setupAdminPanelShell() {
  const panel = document.getElementById('admin-panel');
  const openBtn = document.getElementById('openAdminPanel');
  const closeBtn = document.getElementById('closeAdminPanel');
  if (!panel || panel.dataset.shellReady === '1') return;
  panel.dataset.shellReady = '1';

  function openPanel() {
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  }

  openBtn?.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closePanel();
  });

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-admin-tab');
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.toggle('active', b === button));
      document.querySelectorAll('[data-admin-panel]').forEach((box) => {
        box.classList.toggle('active', box.getAttribute('data-admin-panel') === tab);
      });
    });
  });
}

async function fetchAdminPlayers(prefix = '') {
  const data = await adminGet('players?prefix=' + encodeURIComponent(prefix));
  return data.players || [];
}

function setupAdminPlayerAutocomplete() {
  const input = document.getElementById('admin-login');
  const box = document.getElementById('admin-player-suggestions');
  if (!input || !box || input.dataset.autocompleteReady === '1') return;
  input.dataset.autocompleteReady = '1';

  let timer = null;

  async function updateSuggestions() {
    const prefix = input.value.trim().toLowerCase();
    const players = await fetchAdminPlayers(prefix);

    if (!players.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }

    box.innerHTML = players.map((p) => {
      const login = String(p.login || '').toLowerCase();
      const display = p.display_name || p.login || login;
      return '<button type="button" data-admin-suggest="' + login + '"><b>' + login + '</b><small>' + display + ' · ур. ' + (p.level || 0) + '</small></button>';
    }).join('');

    box.classList.remove('hidden');
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => updateSuggestions().catch(() => {}), 120);
  });

  input.addEventListener('focus', () => updateSuggestions().catch(() => {}));

  box.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-admin-suggest]');
    if (!btn) return;
    input.value = btn.getAttribute('data-admin-suggest');
    box.classList.add('hidden');
    refreshAdminPlayer().catch((e) => setAdminStatus(e.message, true));
  });

  document.addEventListener('click', (event) => {
    if (event.target === input || box.contains(event.target)) return;
    box.classList.add('hidden');
  });
}

async function initAdminPanelGuard() {
  const panel = document.getElementById("admin-panel");
  const entry = document.getElementById("admin-entry");
  if (!panel) return;

  try {
    const res = await fetch("/api/me");
    const me = await res.json();
    const user = me.user || me.profile || me;

    if (!isAdminUser(user)) {
      panel.remove();
      entry?.remove();
      return;
    }

    entry?.classList.remove("hidden");
    setupAdminPanelShell();
    setupAdminPlayerAutocomplete();
    bindAdminPanel();
    bindExtendedAdminPanel();
    loadAdminChecklist().catch(() => {});
  } catch (_) {
    panel.remove();
    entry?.remove();
  }
}

document.addEventListener("DOMContentLoaded", initAdminPanelGuard);


function eventTypeLabel(type) {
  const map = {
    upgrade: 'Ап фермы',
    building_buy: 'Покупка здания',
    building_upgrade: 'Ап здания',
    market_buy_parts: 'Рынок: покупка',
    market_sell_parts: 'Рынок: продажа',
    raid_power_upgrade: 'Ап рейд-силы',
    protection_upgrade: 'Ап защиты',
    turret_upgrade: 'Ап турели',
    raid: 'Рейд',
    case_open: 'Кейс',
    gamus_claim: 'GAMUS',
    off_collect: 'Оффсбор',
    collect: 'Сбор',
    license_buy: 'Лицензия',
    admin_farm_balance: 'Админ: баланс фермы',
    admin_upgrade_balance: 'Админ: бонусный баланс',
    admin_parts: 'Админ: запчасти',
    admin_set_level: 'Админ: уровень',
    admin_set_protection: 'Админ: защита',
    admin_set_raid_power: 'Админ: рейд-сила',
    admin_reset_raid_cooldown: 'Админ: сброс КД',
    admin_delete_buildings: 'Админ: удаление построек',
    admin_delete_farm: 'Админ: удаление фермы',
    admin_transfer_farm: 'Админ: перенос фермы',
    admin_clear_debt: 'Админ: списание долга',
    admin_reset_cases: 'Админ: сброс кейсов',
    admin_reset_gamus: 'Админ: сброс GAMUS',
    admin_set_market_stock: 'Админ: склад рынка'
  };
  return map[type] || type || 'событие';
}

function describePayload(payload = {}, type = '') {
  if (!payload || typeof payload !== 'object') return '';
  if (type === 'raid' || payload.stolen !== undefined || payload.turret_refund !== undefined) {
    const blockedByTurret = !!(payload.raid_blocked_by_turret || payload.killed_by_turret || payload.turret_triggered);
    const target = payload.target ? 'цель: ' + payload.target : '';
    const strength = payload.strength !== undefined ? 'сила: ' + formatNumber(payload.strength) + '% x' + (payload.punish_mult || 1) : '';
    const stolen = blockedByTurret ? 'рейд отбит турелью' : 'украдено: ' + formatNumber(payload.stolen || 0) + '💰';
    const bonus = payload.bonus_stolen !== undefined ? 'бонус: ' + formatNumber(payload.bonus_stolen || 0) + '💎' : '';
    const block = payload.blocked !== undefined ? 'блок: ' + formatNumber(payload.blocked || 0) + '🛡' : '';
    const turret = payload.turret_refund ? 'турель списала с атакующего: ' + formatNumber(payload.turret_refund) + '💰' : '';
    return [target, strength, stolen, bonus, block, turret].filter(Boolean).join(' | ');
  }
  const parts = [];
  if (payload.building) parts.push('здание: ' + payload.building);
  if (payload.upgraded !== undefined) parts.push('+' + payload.upgraded + ' ур.');
  if (payload.totalCost !== undefined) parts.push(formatNumber(payload.totalCost) + '💰');
  if (payload.totalParts !== undefined) parts.push(formatNumber(payload.totalParts) + '🔧');
  if (payload.amount !== undefined) parts.push('изменение: ' + formatNumber(payload.amount));
  if (payload.next !== undefined) parts.push('итог: ' + formatNumber(payload.next));
  if (payload.income !== undefined) parts.push('доход: ' + formatNumber(payload.income));
  if (payload.partsIncome !== undefined) parts.push('запчасти: ' + formatNumber(payload.partsIncome));
  if (payload.cost !== undefined) parts.push('цена: ' + formatNumber(payload.cost));
  if (payload.money !== undefined) parts.push('монеты: ' + formatNumber(payload.money));
  if (payload.parts !== undefined) parts.push('детали: ' + formatNumber(payload.parts));
  if (payload.oldLogin && payload.newLogin) parts.push(payload.oldLogin + ' → ' + payload.newLogin);
  if (payload.stock !== undefined) parts.push('склад: ' + formatNumber(payload.stock));
  if (payload.debt !== undefined) parts.push('долг: ' + formatNumber(payload.debt));
  return parts.join(' | ') || JSON.stringify(payload).slice(0, 180);
}

function renderEventsList(events) {
  if (!events || !events.length) return '<p>Событий пока нет.</p>';
  return '<div class="events-list">' + events.map((event) => {
    const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
    const who = event.login ? ' @' + event.login : '';
    return '<div class="event-row"><b>' + eventTypeLabel(event.type) + '</b>' + who + '<br><small>' + date + '</small><div>' + describePayload(event.payload, event.type) + '</div></div>';
  }).join('') + '</div>';
}

async function loadHistory() {
  const box = document.getElementById('historyBox');
  if (!box) return;
  const type = document.getElementById('historyType')?.value || '';
  const url = '/api/farm/history?limit=100' + (type ? '&type=' + encodeURIComponent(type) : '');
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'history_failed');
  box.innerHTML = renderEventsList(data.events || []);
}

function renderAdminEvents(events) {
  const box = document.getElementById('admin-events-box');
  if (!box) return;
  box.innerHTML = renderEventsList(events || []);
}

async function loadAdminEvents() {
  const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase() || '';
  const type = document.getElementById('admin-events-type')?.value || '';
  const params = new URLSearchParams({ limit: '120' });
  if (login) params.set('login', login);
  if (type) params.set('type', type);
  const data = await adminGet('events?' + params.toString());
  renderAdminEvents(data.events || []);
}

async function loadAdminChecklist() {
  const data = await adminGet('checklist');
  const box = document.getElementById('admin-status');
  if (!box || !data.checks) return;
  const text = 'Чеклист 1:1: ' + data.checks.map((c) => c.title).join(' / ');
  if (!box.textContent) box.textContent = text;
}

function bindExtendedAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel || panel.dataset.extendedBound === '1') return;
  panel.dataset.extendedBound = '1';

  const loginOrError = () => {
    const login = adminLoginValue();
    if (!login) {
      setAdminStatus('Укажи ник игрока', true);
      return null;
    }
    return login;
  };


  document.getElementById('admin-sync-from-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('sync-from-wizebot', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-push-to-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('push-to-wizebot', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-sync-harvest-from-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('sync-harvest-from-wizebot', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-transfer-farm')?.addEventListener('click', async () => {
    try {
      const oldLogin = document.getElementById('admin-transfer-from')?.value?.trim()?.toLowerCase();
      const newLogin = document.getElementById('admin-transfer-to')?.value?.trim()?.toLowerCase();
      if (!oldLogin || !newLogin) return setAdminStatus('Укажи старый и новый ник', true);
      if (!confirm('Перенести ферму ' + oldLogin + ' → ' + newLogin + '?')) return;
      const data = await adminPost('transfer-farm', { oldLogin, newLogin });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-set-market-stock')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const stock = document.getElementById('admin-market-stock')?.value;
      const data = await adminPost('set-market-stock', { login, stock });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-clear-debt')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('clear-debt', { login });
      setAdminStatus(data.message);
      await refreshAdminPlayer();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-clear-all-debts')?.addEventListener('click', async () => {
    try {
      if (!confirm('Списать долги всем игрокам с отрицательным фермерским балансом?')) return;
      const data = await adminPost('clear-debt', {});
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-gamus')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('reset-gamus', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-cases')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('reset-cases', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-cases-all')?.addEventListener('click', async () => {
    try {
      if (!confirm('Сбросить кейсы всем игрокам?')) return;
      const data = await adminPost('reset-cases', {});
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-load-events')?.addEventListener('click', async () => {
    try {
      await loadAdminEvents();
      setAdminStatus('Админ-журнал загружен');
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-delete-turret')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      if (!confirm('Удалить турель у ' + login + '?')) return;
      const data = await adminPost('delete-turret', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-restore-backup')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      if (!confirm('Восстановить последний backup фермы для ' + login + '?')) return;
      const data = await adminPost('restore-backup', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-set-roulette-tickets')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const amount = document.getElementById('admin-roulette-tickets')?.value;
      const data = await adminPost('set-roulette-tickets', { login, amount });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-run-1to1-check')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('run-1to1-check', { login });
      const box = document.getElementById('admin-events-box');
      if (box) box.innerHTML = renderAdminCheckReport(data.report);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('historyRefreshBtn')?.addEventListener('click', () => {
    loadHistory().catch((e) => showMessage('❌ История: ' + e.message));
  });
  document.getElementById('historyType')?.addEventListener('change', () => {
    loadHistory().catch((e) => showMessage('❌ История: ' + e.message));
  });
});


/* === FINAL UI / UX PATCH === */
function showPrettyModal({ title = '', subtitle = '', body = '', footer = '', wide = false, autoCloseMs = 0, kind = '' } = {}) {
  let root = document.getElementById('prettyModalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'prettyModalRoot';
    root.className = 'pretty-modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="pretty-modal-backdrop ${kind}">
      <div class="pretty-modal-card ${wide ? 'wide' : ''}">
        <button type="button" class="pretty-modal-close">×</button>
        <div class="pretty-modal-head">
          <h3>${title}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <div class="pretty-modal-body">${body}</div>
        ${footer ? `<div class="pretty-modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
  root.classList.add('active');
  const close = () => {
    root.classList.remove('active');
    setTimeout(() => { if (!root.classList.contains('active')) root.innerHTML = ''; }, 180);
  };
  root.querySelector('.pretty-modal-close')?.addEventListener('click', close);
  root.querySelector('.pretty-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === root.querySelector('.pretty-modal-backdrop')) close();
  });
  if (autoCloseMs > 0) setTimeout(close, autoCloseMs);
  return { root, close };
}

function confirmFarmModal({ title, body, confirmText = 'Подтвердить', cancelText = 'Отмена', kind = '' } = {}) {
  return new Promise((resolve) => {
    const modal = showPrettyModal({
      title,
      body,
      footer: `<button type="button" class="modal-btn secondary" data-modal-cancel>${cancelText}</button><button type="button" class="modal-btn" data-modal-confirm>${confirmText}</button>`,
      kind
    });
    modal.root.querySelector('[data-modal-cancel]')?.addEventListener('click', () => { modal.close(); resolve(false); });
    modal.root.querySelector('[data-modal-confirm]')?.addEventListener('click', () => { modal.close(); resolve(true); });
  });
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
  root.prepend(toast);
  const close = () => toast.remove();
  toast.querySelector('.action-toast-close')?.addEventListener('click', close);
  setTimeout(() => toast.classList.add('visible'), 20);
  setTimeout(close, options.timeout || 9000);
}

function showCaseHistoryModal(history = []) {
  const rows = history.length
    ? history.slice(0, 20).map((item, index) => `
        <div class="history-detail-card">
          <div><b>#${index + 1}</b> · ${new Date(item.date).toLocaleString('ru-RU')}</div>
          <div>🎁 Выигрыш: <b>${prizeLabel(item)}</b></div>
          <div>💰 Цена открытия: <b>${formatNumber(item.cost || 0)}💰</b></div>
          <div>🧮 Тип: <b>${item.type === 'parts' ? 'Запчасти' : 'Бонусные'}</b></div>
        </div>
      `).join('')
    : '<div class="history-detail-card">История кейсов пока пустая.</div>';
  showPrettyModal({ title: '🎰 Последние кейсы', subtitle: 'Полная красивая история последних открытий', body: `<div class="history-detail-grid">${rows}</div>`, wide: true });
}

function ensureMainActionButtons(data) {
  const grid = document.querySelector('.action-grid-top');
  if (!grid) return;
  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) collectBtn.style.display = 'none';

  let raidActionBtn = document.getElementById('raidActionBtn');
  if (!raidActionBtn) {
    raidActionBtn = document.createElement('button');
    raidActionBtn.id = 'raidActionBtn';
    raidActionBtn.className = 'compact-action danger-lite';
    grid.prepend(raidActionBtn);
    raidActionBtn.addEventListener('click', doRaid);
  }

  const raid = data.raid || {};
  const raidReady = !raid.remainingMs;
  raidActionBtn.disabled = !raid.unlocked || !raidReady;
  raidActionBtn.innerHTML = raid.unlocked
    ? `🏴 Рейд<br><small>${raidReady ? 'готов к атаке' : 'кд ' + formatTime(raid.remainingMs)}</small>`
    : '🏴 Рейд<br><small>с 30 уровня</small>';

  const upgrade1Btn = document.getElementById('upgrade1Btn');
  const upgrade10Btn = document.getElementById('upgrade10Btn');
  if (upgrade1Btn) {
    upgrade1Btn.classList.add('compact-action');
    upgrade1Btn.innerHTML = `⬆️ Улучшить ферму +1<br><small id="upgrade1Text">${data.nextUpgrade ? formatNumber(data.nextUpgrade.cost) + '💰' + (data.nextUpgrade.parts ? ' / ' + formatNumber(data.nextUpgrade.parts) + '🔧' : '') : 'максимум'}</small>`;
  }
  if (upgrade10Btn) {
    upgrade10Btn.classList.add('compact-action');
    upgrade10Btn.innerHTML = '🚀 Улучшить ферму +10<br><small>до 10 уровней</small>';
  }
}

function render(data) {
  state = data;
  const el = document.getElementById('profile');
  const p = data.profile || {};
  const hourly = data.farmInfo?.hourly || {};
  const syncText = p.last_wizebot_sync_at ? new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU') : 'ещё не было';
  const avatar = data.user.avatarUrl ? `<img class="profile-avatar-big" src="${data.user.avatarUrl}" alt="avatar">` : '<div class="profile-avatar-big profile-avatar-fallback">🌾</div>';
  el.innerHTML = `
    <div class="profile-card-final visual-profile-patch">
      <div class="profile-main-left">
        ${avatar}
        <div>
          <div class="profile-kicker">Игрок</div>
          <div class="profile-name-final">${data.user.displayName}</div>
          <div class="profile-status-pill">${data.nextUpgrade ? '✅ Ферма активна' : '✅ Максимальный уровень'}</div>
        </div>
      </div>
      <div class="profile-stats-final stats-2row-grid">
        <div class="stat-tile accent"><span>🌾 Уровень</span><b>${p.level || 0}</b></div>
        <div class="stat-tile gold"><span>💰 Голда</span><b>${formatNumber(ordinaryCoins(p))}</b></div>
        <div class="stat-tile"><span>🌾 Баланс фермы</span><b>${formatNumber(farmCoins(p))}</b></div>
        <div class="stat-tile"><span>💎 Баланс бонусных</span><b>${formatNumber(bonusCoins(p))}</b></div>
        <div class="stat-tile"><span>🔧 Запчасти</span><b>${formatNumber(p.parts || 0)}</b></div>

        <div class="stat-tile"><span>📈 Доход в час</span><b>${formatNumber(hourly.total || 0)}</b></div>
        <div class="stat-tile"><span>🛠 Доход запчастей/ч</span><b>${formatNumber(hourly.parts || 0)}</b></div>
        <div class="stat-tile"><span>💎 Доход бонусных/ч</span><b>${formatNumber((p.farm?.buildings?.['завод'] || 0) * 2000 + (p.farm?.buildings?.['фабрика'] || 0) * 4000 + Math.floor((((p.farm?.buildings?.['завод'] || 0) * 2000) + ((p.farm?.buildings?.['фабрика'] || 0) * 4000)) * ((p.farm?.buildings?.['шахта'] || 0) / 100)))}</b></div>
        <div class="stat-tile"><span>⚔️ Рейд-сила</span><b>${formatNumber(p.raid_power || 0)}</b></div>
        <div class="stat-tile"><span>🛡 Защита</span><b>${formatNumber(p.protection_level || 0)}</b></div>
        <div class="stat-tile"><span>🎟 Лицензия</span><b>до ${p.license_level ? p.license_level : 39}</b><small>🔄 ${syncText}</small></div>
      </div>
    </div>
  `;
  renderQuickStatus(data);
  ensureMainActionButtons(data);
  renderLicense(data);
  renderMarket(data);
  renderCombat(data);
  renderExtras(data);
  renderInfo(data);
  renderBuildings(data);
}

function renderQuickStatus(data) {
  let box = document.getElementById('quickStatus');
  const profile = data.profile;
  const next = data.nextUpgrade;
  if (!box) {
    box = document.createElement('section');
    box.id = 'quickStatus';
    box.className = 'quick-status';
    document.getElementById('profile')?.insertAdjacentElement('afterend', box);
  }
  let upgradeText = '✅ Ферма уже на максимальном уровне';
  if (next) {
    const st = resourceStatus(profile, next.cost, next.parts);
    const possible = (st.coinsOk && st.partsOk) ? 'Ресурсов хватает для следующего уровня.' : `Не хватает: ${st.missingCoins ? formatNumber(st.missingCoins) + '💰 ' : ''}${st.missingParts ? formatNumber(st.missingParts) + '🔧' : ''}`;
    upgradeText = `⬆️ Следующий ап: ${formatNumber(next.cost)}💰${next.parts ? ' / ' + formatNumber(next.parts) + '🔧' : ''}. ${possible}`;
  }
  box.innerHTML = `
    <div><b>Текущие ресурсы</b></div>
    <div class="quick-status-grid compact-stats">
      <span>💰 Голда: <b>${formatNumber(ordinaryCoins(profile))}</b></span>
      <span>🌾 Ферма: <b>${formatNumber(farmCoins(profile))}</b></span>
      <span>💎 Бонусные: <b>${formatNumber(bonusCoins(profile))}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(profile.parts || 0)}</b></span>
    </div>
    <div class="quick-status-upgrade">${upgradeText}</div>
  `;
}

function renderLicense(data) {
  const box = document.getElementById('licenseBox');
  if (!box) return;
  const next = data.nextLicense;
  if (!next) {
    box.innerHTML = '';
    box.style.display = 'none';
    return;
  }
  box.style.display = '';
  const p = data.profile || {};
  const st = resourceStatus(p, next.cost, 0);
  box.innerHTML = `
    <div class="license-card compact-license-card">
      <h2>🎟 Лицензии</h2>
      <p>Сейчас открыто до: <b>${p.license_level ? p.license_level : 39}</b> уровня</p>
      <p>Следующая лицензия: <b>${next.level}</b> уровень</p>
      <p>Цена: <b>${formatNumber(next.cost)}💰</b></p>
      <p class="resource-line">У тебя: <b>${formatNumber(st.coins)}💰</b>${st.coinsOk ? ' ✅' : ` ❌ не хватает ${formatNumber(st.missingCoins)}💰`}</p>
      <button id="buyLicenseBtn">🎟 Купить лицензию до ${next.level}</button>
    </div>
  `;
  document.getElementById('buyLicenseBtn')?.addEventListener('click', buyLicense);
}

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;
  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const canBuyOne = stock > 0 && upgradeBalance >= buyPrice;
  const canSellOne = parts > 0;
  box.innerHTML = `
    <div class="market-hero polished-market-hero">
      <div class="market-stat"><span>📦 Склад</span><b>${formatNumber(stock)}🔧</b></div>
      <div class="market-stat"><span>🔵 Купить</span><b>1🔧 = ${formatNumber(buyPrice)}💎</b></div>
      <div class="market-stat"><span>🟢 Продать</span><b>1🔧 = ${formatNumber(sellPrice)}💎</b></div>
    </div>
    <div class="market-wallet polished-wallet">
      <span>💎 Ап-баланс: <b>${formatNumber(upgradeBalance)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="market-actions pretty-actions polished-market-actions">
      <input id="marketQty" type="number" min="1" step="1" value="${lastMarketQty}" />
      <button id="marketBuyBtn" ${!canBuyOne ? 'disabled' : ''}>🔵 Купить запчасти</button>
      <button id="marketSellBtn" ${!canSellOne ? 'disabled' : ''}>🟢 Продать запчасти</button>
    </div>
    <p class="market-hint">Покупка списывает 💎 и выдаёт 🔧. Продажа выдаёт 💎. Новые уведомления теперь показываются сверху списка.</p>
  `;
  const qtyInput = document.getElementById('marketQty');
  qtyInput?.addEventListener('input', () => {
    const value = Math.max(1, Number(qtyInput.value || 1));
    lastMarketQty = value;
    localStorage.setItem('mooseFarmLastMarketQty', String(value));
  });
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}

function calcAffordableBuildingLevels(conf = {}, lvl = 0, coins = 0, parts = 0) {
  let count = 0;
  let currentCoins = Number(coins || 0);
  let currentParts = Number(parts || 0);
  let next = lvl + 1;
  const buyCoins = Number(conf.baseCost || 0);
  const buyParts = Number(conf.partsBase || 0);
  const maxLevel = Number(conf.maxLevel || 0) || 100000;
  while (next <= maxLevel) {
    const needCoins = buyCoins + Math.max(0, next - 1) * Number(conf.costIncreasePerLevel || 0);
    const needParts = buyParts + Math.max(0, next - 1) * Number(conf.partsPerLevel || 0);
    if (currentCoins < needCoins || currentParts < needParts) break;
    currentCoins -= needCoins;
    currentParts -= needParts;
    count += 1;
    next += 1;
  }
  return count;
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;
  const p = data.profile || {};
  const buildingsConfig = p.configs?.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);
  if (!keys.length) {
    el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>';
    return;
  }
  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0);
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const buyCoins = Number(conf.baseCost || 0);
    const buyParts = Number(conf.partsBase || 0);
    const nextLevel = lvl + 1;
    const shownCoins = buyCoins + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
    const shownParts = buyParts + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    const st = resourceStatus(p, shownCoins, shownParts);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordLevels = levelLocked || maxed ? 0 : calcAffordableBuildingLevels(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const shortage = [];
    if (!st.coinsOk) shortage.push(`💰 не хватает ${formatNumber(st.missingCoins)}`);
    if (!st.partsOk) shortage.push(`🔧 не хватает ${formatNumber(st.missingParts)}`);
    return `
      <div class="building-card ${levelLocked ? 'locked-building' : shortage.length ? 'shortage-building' : 'ready-building'} polished-building-card">
        <div class="building-title-row">
          <h3>${conf.name || key}</h3>
          <span class="building-badge">${isBuilt ? 'ур. ' + lvl + (maxLevel ? '/' + maxLevel : '') : 'не построено'}</span>
        </div>
        <p class="building-subtitle">${levelLocked ? `🔒 Нужен уровень фермы ${requiredLevel}. Сейчас ${farmLevel}.` : isBuilt ? (maxed ? '✅ Максимальный уровень' : `Следующий ап до ${nextLevel} ур.`) : 'Можно построить'}</p>
        <div class="building-cost-box"><span>Цена</span><b>${formatNumber(shownCoins)}💰</b><b>${formatNumber(shownParts)}🔧</b></div>
        <div class="building-wallet-box"><span>У тебя</span><b>${formatNumber(currentCoins(p))}💰</b><b>${formatNumber(p.parts || 0)}🔧</b></div>
        ${levelLocked ? `<p class="shortage">Недоступно: нужен ${requiredLevel} уровень фермы</p>` : ''}
        ${!levelLocked && shortage.length ? `<p class="shortage">${shortage.join(' · ')}</p>` : ''}
        ${!levelLocked && !shortage.length && !maxed ? `<p class="okline">✅ Ресурсов хватает. Хватит примерно на ${Math.max(1, affordLevels)} ур.</p>` : ''}
        ${!isBuilt ? `<button data-building-buy="${key}" data-required-level="${requiredLevel}" ${levelLocked ? 'disabled' : ''}>🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed ? 'disabled' : ''}>⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed ? 'disabled' : ''}>⬆️ Ап +10</button></div>`}
      </div>
    `;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => {
    const required = Number(btn.getAttribute('data-required-level') || 0);
    const current = Number(state?.profile?.level || 0);
    if (current < required) {
      showMessage(`⛔ Здание пока недоступно: нужен уровень фермы ${required}, сейчас ${current}.`);
      return;
    }
    await buyBuilding(btn.getAttribute('data-building-buy'));
  }));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => {
    await upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1));
  }));
}

function renderCombat(data) {
  const box = document.getElementById('combatBox');
  if (!box) return;
  const p = data.profile || {};
  const raidPower = data.raidUpgrades?.raidPower || {};
  const protection = data.raidUpgrades?.protection || {};
  const turret = data.turret || {};
  const streamOnline = !!(data.streamOnline || p.stream_online);
  box.innerHTML = `
    <div class="combat-card">
      <h3>⚔️ Рейд-сила</h3>
      <p>Уровень: <b>${formatNumber(raidPower.level || 0)}/${formatNumber(raidPower.maxLevel || 200)}</b></p>
      <p>Цена следующего: <b>${raidPower.nextCost ? formatNumber(raidPower.nextCost) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b></p>
      <div class="building-actions"><button data-raid-power="1" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +1</button><button data-raid-power="10" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +10</button></div>
      ${!raidPower.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>
    <div class="combat-card">
      <h3>🛡 Защита</h3>
      <p>Уровень: <b>${formatNumber(protection.level || 0)}/${formatNumber(protection.maxLevel || 120)}</b> (${Number(protection.percent || 0).toFixed(1)}%)</p>
      <p>Цена следующего: <b>${protection.nextCost ? formatNumber(protection.nextCost) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b></p>
      <div class="building-actions"><button data-protection="1" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +1</button><button data-protection="10" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +10</button></div>
      ${!protection.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>
    <div class="combat-card">
      <h3>🔫 Турель</h3>
      <p>Уровень: <b>${formatNumber(turret.level || 0)}/${formatNumber(turret.maxLevel || 20)}</b> | шанс: <b>${formatNumber(turret.chance || 0)}%</b></p>
      <p>Следующий: <b>${turret.nextUpgrade ? formatNumber(turret.nextUpgrade.chance || 0) + '% за ' + formatNumber(turret.nextUpgrade.cost || 0) + '💰 / ' + formatNumber(turret.nextUpgrade.parts || 0) + '🔧' : 'максимум'}</b></p>
      <p class="resource-line">У тебя: <b>${formatNumber(currentCoins(p))}💰</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>
      <button id="turretUpgradeBtn" ${turret.nextUpgrade ? '' : 'disabled'}>🔫 Улучшить турель</button>
    </div>
    <div class="combat-card muted-card">
      <h3>ℹ️ Статус рейдов</h3>
      <p>Кнопка рейда вынесена в основные действия сверху для более быстрого доступа.</p>
      <p>Оффсбор: <b>${streamOnline ? 'сейчас недоступен (стрим онлайн)' : 'можно забирать при оффлайне'}</b></p>
    </div>
  `;
  document.querySelectorAll('[data-raid-power]').forEach((btn) => btn.addEventListener('click', () => upgradeRaidPower(Number(btn.dataset.raidPower || 1))));
  document.querySelectorAll('[data-protection]').forEach((btn) => btn.addEventListener('click', () => upgradeProtection(Number(btn.dataset.protection || 1))));
  document.getElementById('turretUpgradeBtn')?.addEventListener('click', upgradeTurret);
}

function renderExtras(data) {
  const box = document.getElementById('extrasBox');
  if (!box) return;
  const p = data.profile || {};
  const cs = data.caseStatus || {};
  const gamus = data.gamus || {};
  const ranges = gamus.ranges || {};
  const streamOnline = !!(data.streamOnline || p.stream_online);
  const samplePrizeMoney = Math.round((ranges.minMoney || 0) * Number(cs.finalMultiplier || 1));
  const samplePrizeMoneyMax = Math.round((ranges.maxMoney || 0) * Number(cs.finalMultiplier || 1));
  box.innerHTML = `
    <div class="combat-card polished-extra-card">
      <h3>🎰 Кейс</h3>
      <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Цена: <b>${formatNumber(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
      <p>Призы уже с множителем: <b>💎/🔧 ${formatNumber(samplePrizeMoney || 0)} – ${formatNumber(samplePrizeMoneyMax || 0)}</b></p>
      <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
      <div class="extra-actions"><button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button><button id="showCaseHistoryBtn" class="ghost-action">📜 Последние кейсы</button></div>
    </div>
    <div class="combat-card polished-extra-card">
      <h3>🧠 GAMUS</h3>
      <p>Тир: <b>${formatNumber(ranges.tierLevel || 0)}</b> | шахта: <b>${formatNumber(ranges.mineLevel || 0)}</b></p>
      <p>Награда: <b>${formatNumber(ranges.minMoney || 0)}-${formatNumber(ranges.maxMoney || 0)}💎</b> / <b>${formatNumber(ranges.minParts || 0)}-${formatNumber(ranges.maxParts || 0)}🔧</b></p>
      <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
      <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
    </div>
    <div class="combat-card polished-extra-card">
      <h3>🌙 Оффсбор</h3>
      <p>Красивый сокращённый сбор 50% от обычного дохода, как в WizeBot.</p>
      <p>Сейчас можно получить с фермы: <b>${formatNumber(p.farm_balance || 0)}🌾</b> и до <b>${formatNumber(p.parts || 0)}🔧</b></p>
      <button id="offCollectBtn" ${streamOnline ? 'disabled' : ''}>🌙 Забрать оффсбор</button>
      <small>${streamOnline ? 'Во время стрима оффсбор отключён.' : 'Доступен только когда стрим оффлайн.'}</small>
    </div>
  `;
  document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
  document.getElementById('showCaseHistoryBtn')?.addEventListener('click', () => showCaseHistoryModal(cs.history || []));
  document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
  document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
}

function renderInfo(data) {
  const infoBox = document.getElementById('infoBox');
  const topsBox = document.getElementById('topsBox');
  if (!infoBox) return;
  const info = data.farmInfo || {};
  const raidInfo = data.raidInfo || {};
  const hourly = info.hourly || {};
  const balances = info.balances || {};
  const buildings = info.buildings || [];
  const raidLogs = (raidInfo.logs || []).slice(0, 8);
  infoBox.innerHTML = `
    <div class="info-grid rich-info-grid">
      <div class="info-metric"><span>💰 Обычные</span><b>${formatNumber(balances.twitch || 0)}</b><small>монеты Twitch / !мани</small></div>
      <div class="info-metric"><span>🌾 Ферма</span><b>${formatNumber(balances.farm || 0)}</b><small>вирт. монеты фермы</small></div>
      <div class="info-metric"><span>💎 Ап-баланс</span><b>${formatNumber(balances.upgrade || 0)}</b><small>бонусные</small></div>
      <div class="info-metric"><span>🔧 Запчасти</span><b>${formatNumber(balances.parts || 0)}</b><small>детали</small></div>
      <div class="info-metric"><span>📈 Доход/ч</span><b>${formatNumber(hourly.total || 0)}</b><small>пассив ${formatNumber(hourly.passive || 0)} · урожай ${formatNumber((hourly.plants || 0) + (hourly.animals || 0))} · здания ${formatNumber(hourly.buildingCoins || 0)}</small></div>
      <div class="info-metric"><span>🛠 Детали/ч</span><b>${formatNumber(hourly.parts || 0)}</b><small>с учётом шахты / фабрики / завода</small></div>
      <div class="info-metric wide"><span>🏗 Здания</span><b>${buildings.length}</b><small>${buildings.length ? buildings.map((b) => `${b.config?.name || b.key}: ${b.level}`).join(' · ') : 'нет построек'}</small></div>
      <div class="info-metric"><span>🏴 Рейды за 14д</span><b>${formatNumber(raidInfo.twoWeeks?.count || 0)} шт.</b><small>${formatNumber(raidInfo.twoWeeks?.stolen || 0)}💰 · ${formatNumber(raidInfo.twoWeeks?.bonus || 0)}💎</small></div>
    </div>
    <div class="raid-log-list beautiful-raid-log">
      <div class="section-inline-title">Последние рейды</div>
      ${raidLogs.length ? raidLogs.map((r, i) => `<div class="raid-log-row"><b>${i + 1}.</b> ${new Date(r.timestamp).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: <b>${formatNumber(r.stolen)}💰</b>, <b>${formatNumber(r.bonus_stolen || 0)}💎</b></div>`).join('') : '<div class="raid-log-row">Рейдов пока нет</div>'}
    </div>
    <button id="refreshTopBtn">🏆 Обновить топы</button>
  `;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
  if (topsBox && !topsBox.dataset.loaded) loadTops();
}

async function openCase() {
  const data = await postJson('/api/farm/case/open');
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
      cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showCaseOverlay(data.prize);
  showPrettyModal({
    title: '🎉 Кейс открыт',
    subtitle: 'Приз уже посчитан с множителем',
    body: `<div class="result-highlight"><div>🎁 Выигрыш</div><b>${prizeLabel(data.prize)}</b></div><div class="result-mini-grid"><div><span>💰 Цена</span><b>${formatNumber(data.cost || 0)}💰</b></div><div><span>🧮 Множитель</span><b>x${Number(data.prize?.multiplier || 1).toFixed(2)}</b></div><div><span>📦 Тип</span><b>${data.prize?.type === 'parts' ? 'Запчасти' : 'Бонусные'}</b></div></div>`,
    autoCloseMs: 9000,
    kind: 'success'
  });
  showMessage(`🎰 Кейс: выигрыш ${prizeLabel(data.prize)}. Цена ${formatNumber(data.cost)}💰`);
  await loadMe();
}

async function claimGamus() {
  const data = await postJson('/api/farm/gamus/claim');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ GAMUS будет доступен через ${formatTime(data.remainingMs || 0)} (06:00 МСК)` : `❌ GAMUS: ${data.error}`);
    await loadMe();
    return;
  }
  showPrettyModal({
    title: '🎁 GAMUS получен',
    subtitle: `Тир ${data.tierLevel || 0}`,
    body: `<div class="result-mini-grid"><div><span>💎 Монеты</span><b>+${formatNumber(data.money || 0)}</b></div><div><span>🔧 Дала шахта</span><b>+${formatNumber(data.parts || 0)}</b></div><div><span>📈 Тир</span><b>${formatNumber(data.tierLevel || 0)}</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🎁 GAMUS: +${formatNumber(data.money)}💎 и +${formatNumber(data.parts)}🔧 (тир ${data.tierLevel})`);
  await loadMe();
}

async function offCollect() {
  if (state?.streamOnline || state?.profile?.stream_online) {
    showMessage('⛔ Во время стрима оффсбор недоступен.');
    return;
  }
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showPrettyModal({
    title: '🌙 Оффсбор получен',
    subtitle: 'Красивый отчёт по сбору',
    body: `<div class="result-mini-grid"><div><span>🌾 Монеты фермы</span><b>+${formatNumber(data.income || 0)}</b></div><div><span>🔧 Запчасти</span><b>+${formatNumber(data.partsIncome || 0)}</b></div><div><span>⏱ За период</span><b>${formatNumber(data.minutes || 0)} мин</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}💰${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
  await loadMe();
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
  const body = `
    <div class="result-highlight"><div>${turretBlocked ? '🔫 Турель отбила атаку' : '🏴 Атака успешна'}</div><b>${log.target || 'неизвестно'}</b></div>
    <div class="result-mini-grid">
      <div><span>🎯 Цель</span><b>${log.target || '—'}</b></div>
      <div><span>⚔️ Сила</span><b>${formatNumber(log.strength || 0)}%</b></div>
      <div><span>📈 Доход цели</span><b>${formatNumber(log.base_income || 0)}💰</b></div>
      <div><span>💸 Украдено</span><b>${formatNumber(log.stolen || 0)}💰</b></div>
      <div><span>💎 Бонусные</span><b>${formatNumber((log.bonus_stolen || 0) + (log.turret_bonus || 0))}💎</b></div>
      <div><span>🛡 Блок</span><b>${formatNumber(log.blocked || 0)}</b></div>
      ${log.turret_refund ? `<div><span>🔫 Турель списала</span><b>${formatNumber(log.turret_refund)}💰</b></div>` : ''}
      <div><span>🚨 Множитель</span><b>x${formatNumber(log.punish_mult || 1)}</b></div>
    </div>
  `;
  showPrettyModal({ title: turretBlocked ? `🔫 Рейд на ${log.target}: турель` : `🏴 Рейд на ${log.target}`, subtitle: 'Подробный итог атаки', body, autoCloseMs: 12000, wide: true, kind: turretBlocked ? 'danger' : 'success' });
  showRaidDetails(log);
  showMessage(turretBlocked ? `🔫 Рейд на ${log.target} отбит турелью: цель не потеряла монеты | с атакующего списано ${formatNumber(log.turret_refund || 0)}💰` : `🏴 Рейд на ${log.target}: украдено ${formatNumber(log.stolen)}💰`);
  await loadMe();
  if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty');
  const qty = Number(qtyInput?.value || 0);
  if (qty > 0) {
    lastMarketQty = qty;
    localStorage.setItem('mooseFarmLastMarketQty', String(qty));
  }
  const data = await postJson(`/api/farm/market/${action}`, { qty });
  if (!data.ok) {
    const labels = {
      invalid_quantity: 'укажи количество больше 0',
      quantity_too_large: `слишком большое число, максимум ${formatNumber(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: ${formatNumber(data.available || 0)}/${formatNumber(data.needed || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎 ап-баланса: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`,
      market_stock_empty: 'склад рынка пуст',
      not_enough_market_stock: 'на складе рынка недостаточно запчастей'
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  const modalBody = action === 'buy'
    ? `<div class="result-mini-grid"><div><span>🔧 Куплено</span><b>${formatNumber(data.qty)}🔧</b></div><div><span>💎 Потрачено</span><b>${formatNumber(data.totalCost)}💎</b></div><div><span>📦 Склад</span><b>${formatNumber(data.market?.stock ?? 0)}🔧</b></div></div>`
    : `<div class="result-mini-grid"><div><span>🔧 Продано</span><b>${formatNumber(data.qty)}🔧</b></div><div><span>💎 Получено</span><b>${formatNumber(data.totalCost)}💎</b></div><div><span>📦 Склад</span><b>${formatNumber(data.market?.stock ?? 0)}🔧</b></div></div>`;
  showPrettyModal({ title: action === 'buy' ? '🏪 Покупка завершена' : '🏪 Продажа завершена', body: modalBody, autoCloseMs: 7000, kind: 'success' });
  showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [action === 'buy' ? `Куплено: <b>${formatNumber(data.qty)}🔧</b>` : `Продано: <b>${formatNumber(data.qty)}🔧</b>`, action === 'buy' ? `Потрачено: <b>${formatNumber(data.totalCost)}💎</b>` : `Получено: <b>${formatNumber(data.totalCost)}💎</b>`], { kind: 'market' });
  showMessage(action === 'buy' ? `🔵 Куплено ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎` : `🟢 Продано ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎`);
  await loadMe();
}

async function upgradeBuilding(key, count) {
  if (count >= 10) {
    const p = state?.profile || {};
    const conf = p.configs?.buildings?.[key] || {};
    const lvl = Number(p.farm?.buildings?.[key] || 0);
    let sumCoins = 0; let sumParts = 0;
    for (let step = 1; step <= count; step++) {
      const nextLevel = lvl + step;
      sumCoins += Number(conf.baseCost || 0) + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
      sumParts += Number(conf.partsBase || 0) + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    }
    const ok = await confirmFarmModal({ title: `⬆️ Ап ${conf.name || key} +${count}`, body: `<div class="result-mini-grid"><div><span>💰 Будет списано</span><b>${formatNumber(sumCoins)}💰</b></div><div><span>🔧 Будет списано</span><b>${formatNumber(sumParts)}🔧</b></div><div><span>📦 У тебя</span><b>${formatNumber(currentCoins(p))}💰 / ${formatNumber(p.parts || 0)}🔧</b></div></div>`, confirmText: 'Да, улучшить' });
    if (!ok) return;
  }
  const data = await postJson('/api/farm/building/upgrade', { key, count });
  if (!data.ok) {
    const p = data.profile || state?.profile || {};
    const b = (data.buildings || []).find((item) => item.key === key);
    const needCoins = Number(b?.upgradeCost?.coins || data.nextCost || 0);
    const needParts = Number(b?.upgradeCost?.parts || data.nextParts || 0);
    const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
    showMessage(`❌ Здание не улучшено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
    await loadMe();
    return;
  }
  showPrettyModal({ title: `🏗 ${data.name || data.building}`, subtitle: 'Здание улучшено', body: `<div class="result-mini-grid"><div><span>⬆️ Улучшено</span><b>+${formatNumber(data.upgraded || 0)} ур.</b></div><div><span>💰 Списано</span><b>${formatNumber(data.totalCost || 0)}💰</b></div><div><span>🔧 Списано</span><b>${formatNumber(data.totalParts || 0)}🔧</b></div></div>`, autoCloseMs: 7000, kind: 'success' });
  showMessage(`⬆️ ${data.name || data.building}: +${data.upgraded} ур. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

function describePayload(payload = {}, type = '') {
  if (!payload || typeof payload !== 'object') return '';
  if (type === 'sync_wizebot_push' || type === 'sync_wizebot_push_failed') {
    return payload.ok ? `🔄 Пуш в WizeBot выполнен. Ключей обновлено: ${Array.isArray(payload.keys) ? payload.keys.length : 0}` : `⚠️ Ошибка пуша в WizeBot${payload.message ? ': ' + payload.message : ''}`;
  }
  if (type === 'upgrade') return `Улучшено уровней: ${formatNumber(payload.upgraded || 0)} · списано ${formatNumber(payload.totalCost || 0)}💰${payload.totalParts ? ' / ' + formatNumber(payload.totalParts) + '🔧' : ''}`;
  if (type === 'case_open') return `Открыт кейс за ${formatNumber(payload.cost || 0)}💰 · приз ${prizeLabel(payload.prize)}`;
  if (type === 'gamus_claim') return `Получено ${formatNumber(payload.money || 0)}💎 и ${formatNumber(payload.parts || 0)}🔧 · тир ${formatNumber(payload.tierLevel || 0)}`;
  if (type === 'off_collect') return `Оффсбор: +${formatNumber(payload.income || 0)}💰${payload.partsIncome ? ' / +' + formatNumber(payload.partsIncome) + '🔧' : ''} за ${formatNumber(payload.minutes || 0)} мин.`;
  if (type === 'market_buy_parts') return `Покупка: ${formatNumber(payload.qty || 0)}🔧 за ${formatNumber(payload.totalCost || 0)}💎`;
  if (type === 'market_sell_parts') return `Продажа: ${formatNumber(payload.qty || 0)}🔧 за ${formatNumber(payload.totalCost || 0)}💎`;
  if (type === 'license_buy') return `Куплена лицензия до ${formatNumber(payload.licenseLevel || 0)} уровня за ${formatNumber(payload.cost || payload.spent || 0)}💰`;
  if (type === 'raid' || payload.stolen !== undefined || payload.turret_refund !== undefined) {
    const blockedByTurret = !!(payload.raid_blocked_by_turret || payload.killed_by_turret || payload.turret_triggered);
    return blockedByTurret ? `Рейд на ${payload.target || 'цель'} отбит турелью · списано с атакующего ${formatNumber(payload.turret_refund || 0)}💰` : `Рейд на ${payload.target || 'цель'} · украдено ${formatNumber(payload.stolen || 0)}💰 и ${formatNumber(payload.bonus_stolen || 0)}💎`;
  }
  const parts = [];
  if (payload.building) parts.push('здание: ' + payload.building);
  if (payload.upgraded !== undefined) parts.push('+' + payload.upgraded + ' ур.');
  if (payload.totalCost !== undefined) parts.push(formatNumber(payload.totalCost) + '💰');
  if (payload.totalParts !== undefined) parts.push(formatNumber(payload.totalParts) + '🔧');
  if (payload.amount !== undefined) parts.push('изменение: ' + formatNumber(payload.amount));
  if (payload.next !== undefined) parts.push('итог: ' + formatNumber(payload.next));
  if (payload.income !== undefined) parts.push('доход: ' + formatNumber(payload.income));
  if (payload.partsIncome !== undefined) parts.push('запчасти: ' + formatNumber(payload.partsIncome));
  if (payload.cost !== undefined) parts.push('цена: ' + formatNumber(payload.cost));
  if (payload.money !== undefined) parts.push('монеты: ' + formatNumber(payload.money));
  if (payload.parts !== undefined) parts.push('детали: ' + formatNumber(payload.parts));
  if (payload.oldLogin && payload.newLogin) parts.push(payload.oldLogin + ' → ' + payload.newLogin);
  if (payload.stock !== undefined) parts.push('склад: ' + formatNumber(payload.stock));
  if (payload.debt !== undefined) parts.push('долг: ' + formatNumber(payload.debt));
  return parts.join(' | ') || 'Событие выполнено';
}

function renderAdminPlayer(profile) {
  const box = document.getElementById("admin-player-info");
  if (!box) return;
  if (!profile) { box.innerHTML = ""; return; }
  const login = (profile.twitch_login || profile.login || '').toLowerCase();
  box.innerHTML = `
    <div class="admin-player-card pretty-admin-player">
      <div class="admin-player-top"><b>${login || 'unknown'}</b><span>ур. ${profile.level ?? 0}</span></div>
      <div class="admin-profile-grid">
        <div class="admin-mini-card"><span>🌾 Баланс фермы</span><b>${formatNumber(profile.farm_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="farm" placeholder="+1000 / -1000"><button data-admin-quick-action="give-farm-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>💎 Бонусные</span><b>${formatNumber(profile.upgrade_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="upgrade" placeholder="+1кк / -500к"><button data-admin-quick-action="give-upgrade-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>🔧 Запчасти</span><b>${formatNumber(profile.parts ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="parts" placeholder="+1000 / -1000"><button data-admin-quick-action="give-parts">Применить</button></div></div>
        <div class="admin-mini-card"><span>🌾 Уровень</span><b>${formatNumber(profile.level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="level" placeholder="120"><button data-admin-quick-action="set-level">Применить</button></div></div>
        <div class="admin-mini-card"><span>🛡 Защита</span><b>${formatNumber(profile.protection_level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="protection" placeholder="0-120"><button data-admin-quick-action="set-protection">Применить</button></div></div>
        <div class="admin-mini-card"><span>⚔️ Рейд-сила</span><b>${formatNumber(profile.raid_power ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="raid" placeholder="0-200"><button data-admin-quick-action="set-raid-power">Применить</button></div></div>
        <div class="admin-mini-card"><span>🎟 Лицензия</span><b>${formatNumber(profile.license_level ?? 0)}</b><small>редактирование пока через команды/БД</small></div>
      </div>
      <div class="admin-player-actions-row"><button type="button" data-admin-refresh-player>Обновить игрока</button><button type="button" data-admin-sync-player>Импорт из WizeBot</button><button type="button" data-admin-push-player>Пуш в WizeBot</button></div>
    </div>
  `;
  box.querySelector('[data-admin-refresh-player]')?.addEventListener('click', () => refreshAdminPlayer().catch((e) => setAdminStatus(e.message, true)));
  box.querySelector('[data-admin-sync-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('sync-from-wizebot', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelector('[data-admin-push-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('push-to-wizebot', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelectorAll('[data-admin-quick-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const action = btn.getAttribute('data-admin-quick-action');
        const keyMap = { 'give-farm-balance': 'farm', 'give-upgrade-balance': 'upgrade', 'give-parts': 'parts', 'set-level': 'level', 'set-protection': 'protection', 'set-raid-power': 'raid' };
        const key = keyMap[action];
        const value = box.querySelector(`[data-admin-quick-input="${key}"]`)?.value;
        const body = { login };
        if (action === 'give-farm-balance') body.amount = value;
        if (action === 'give-upgrade-balance') body.amount = value;
        if (action === 'give-parts') body.amount = value;
        if (action === 'set-level') body.level = value;
        if (action === 'set-protection') body.level = value;
        if (action === 'set-raid-power') body.level = value;
        const data = await adminPost(action, body);
        renderAdminPlayer(data.profile);
        setAdminStatus(data.message);
      } catch (e) { setAdminStatus(e.message, true); }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) collectBtn.style.display = 'none';
});

/* === PASS 2 PATCH: stream admin controls and richer raid wording === */
async function loadStreamStatusForAdmin() {
  const box = document.getElementById('admin-stream-status-box');
  if (!box) return;
  try {
    const res = await fetch('/api/admin/stream-status');
    const data = await res.json();
    const st = data.streamStatus || {};
    box.innerHTML = `Стрим: <b>${data.streamOnline ? 'онлайн' : 'оффлайн'}</b> · источник: <b>${st.source || 'unknown'}</b>${st.error ? ` · ошибка: ${st.error}` : ''}`;
  } catch (e) {
    box.textContent = 'Не удалось получить статус стрима: ' + e.message;
  }
}

async function setStreamStatusMode(mode) {
  const res = await fetch('/api/admin/stream-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'stream_status_failed');
  setAdminStatus(data.message || 'Статус стрима обновлён');
  await loadStreamStatusForAdmin();
  await loadMe();
}

document.addEventListener('DOMContentLoaded', () => {
  const extended = document.querySelector('[data-admin-panel="extended"] .admin-grid');
  if (extended && !document.getElementById('admin-stream-card')) {
    const card = document.createElement('div');
    card.id = 'admin-stream-card';
    card.className = 'admin-card';
    card.innerHTML = `
      <h3>📡 Стрим / оффсбор</h3>
      <p class="admin-muted">Можно оставить auto или вручную заблокировать оффсбор.</p>
      <div id="admin-stream-status-box" class="admin-stream-status-box">Загрузка...</div>
      <div class="admin-stream-actions">
        <button type="button" data-stream-mode="auto">Auto</button>
        <button type="button" data-stream-mode="online">Стрим онлайн</button>
        <button type="button" data-stream-mode="offline">Стрим оффлайн</button>
      </div>
    `;
    extended.prepend(card);
    card.querySelectorAll('[data-stream-mode]').forEach((btn) => {
      btn.addEventListener('click', () => setStreamStatusMode(btn.getAttribute('data-stream-mode')).catch((e) => setAdminStatus(e.message, true)));
    });
  }
  loadStreamStatusForAdmin();
});

/* === HOTFIX: case prizes, offcollect text, global market label, detailed top buildings === */
function casePrizeRangeLabel(finalMultiplier) {
  const prizes = [
    { type: 'coins', value: 150000 }, { type: 'parts', value: 12500 }, { type: 'coins', value: 125000 }, { type: 'parts', value: 19000 }, { type: 'coins', value: 110000 },
    { type: 'parts', value: 15000 }, { type: 'coins', value: 180000 }, { type: 'parts', value: 17000 }, { type: 'coins', value: 135000 }, { type: 'parts', value: 13500 },
    { type: 'coins', value: 145000 }, { type: 'parts', value: 14500 }, { type: 'coins', value: 100000 }, { type: 'parts', value: 20000 }, { type: 'coins', value: 130000 },
    { type: 'parts', value: 16000 }, { type: 'coins', value: 155000 }, { type: 'parts', value: 12000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 15500 },
    { type: 'coins', value: 140000 }, { type: 'parts', value: 18000 }, { type: 'coins', value: 170000 }, { type: 'parts', value: 14000 }, { type: 'coins', value: 105000 },
    { type: 'parts', value: 16500 }, { type: 'coins', value: 160000 }, { type: 'parts', value: 17500 }, { type: 'coins', value: 115000 }, { type: 'parts', value: 13000 },
    { type: 'coins', value: 200000 }, { type: 'parts', value: 21000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 16000 }, { type: 'coins', value: 132000 },
    { type: 'parts', value: 22000 }, { type: 'coins', value: 190000 }, { type: 'parts', value: 15800 }, { type: 'coins', value: 128000 }
  ];
  const m = Number(finalMultiplier || 1);
  const coins = prizes.filter((p) => p.type === 'coins').map((p) => Math.floor(p.value * m));
  const parts = prizes.filter((p) => p.type === 'parts').map((p) => Math.floor(p.value * m));
  const minCoins = Math.min.apply(null, coins), maxCoins = Math.max.apply(null, coins);
  const minParts = Math.min.apply(null, parts), maxParts = Math.max.apply(null, parts);
  return `💎 ${formatNumber(minCoins)}–${formatNumber(maxCoins)} / 🔧 ${formatNumber(minParts)}–${formatNumber(maxParts)}`;
}

function buildingBenefitLabel(b = {}) {
  const chunks = [];
  if (b.coinsPerHour) chunks.push(`💰 ${formatNumber(b.coinsPerHour)}/ч`);
  if (b.partsBase) chunks.push(`🔧 ${formatNumber(b.partsBase)}/ч база`);
  if (b.bonusCoins) chunks.push(`💎 ${formatNumber(b.bonusCoins)}/ч`);
  if (b.protection) chunks.push(`🛡 ${formatNumber(b.protection)}/сбор`);
  if (b.weapon) chunks.push(`⚔️ ${formatNumber(b.weapon)}/сбор`);
  if (b.key === 'шахта') chunks.push('⛏ множитель завода/кейсов/GAMUS');
  if (b.key === 'фабрика') chunks.push('🏗 усиливает производство запчастей');
  if (b.key === 'глушилка') chunks.push('📡 снижает шанс турели врага');
  if (b.key === 'центр') chunks.push('🏢 снижает кд рейда');
  return chunks.join(' · ') || 'пассивный бонус здания';
}

function renderExtras(data) {
  const box = document.getElementById('extrasBox');
  if (!box) return;
  const p = data.profile || {};
  const cs = data.caseStatus || {};
  const gamus = data.gamus || {};
  const ranges = gamus.ranges || {};
  const streamOnline = !!(data.streamOnline || p.stream_online);
  box.innerHTML = `
    <div class="combat-card polished-extra-card">
      <h3>🎰 Кейс</h3>
      <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Цена: <b>${formatNumber(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
      <p>Призы согласно коду кейса: <b>${casePrizeRangeLabel(cs.finalMultiplier || 1)}</b></p>
      <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
      <div class="extra-actions"><button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button><button id="showCaseHistoryBtn" class="ghost-action">📜 Последние кейсы</button></div>
    </div>
    <div class="combat-card polished-extra-card">
      <h3>🧠 GAMUS</h3>
      <p>Тир: <b>${formatNumber(ranges.tierLevel || 0)}</b> | шахта: <b>${formatNumber(ranges.mineLevel || 0)}</b></p>
      <p>Награда: <b>${formatNumber(ranges.minMoney || 0)}-${formatNumber(ranges.maxMoney || 0)}💎</b> / <b>${formatNumber(ranges.minParts || 0)}-${formatNumber(ranges.maxParts || 0)}🔧</b></p>
      <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
      <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
    </div>
    <div class="combat-card polished-extra-card">
      <h3>🌙 Оффсбор</h3>
      <p>Оффсбор 50% от сбора фермы.</p>
      <p>Не учитывает бонусные, фабрику, шахту и монетные здания. Запчасти даёт только завод / 2.</p>
      <p>Баланс сейчас: <b>${formatNumber(p.farm_balance || 0)}🌾</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>
      <button id="offCollectBtn" ${streamOnline ? 'disabled' : ''}>🌙 Забрать оффсбор</button>
      <small>${streamOnline ? 'Во время стрима оффсбор отключён.' : 'Доступен только когда стрим оффлайн.'}</small>
    </div>
  `;
  document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
  document.getElementById('showCaseHistoryBtn')?.addEventListener('click', () => showCaseHistoryModal(cs.history || []));
  document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
  document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
}

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;
  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const canBuyOne = stock > 0 && upgradeBalance >= buyPrice;
  const canSellOne = parts > 0;
  box.innerHTML = `
    <div class="market-hero polished-market-hero">
      <div class="market-stat"><span>📦 Общий склад рынка</span><b>${formatNumber(stock)}🔧</b><small>один для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>1🔧 = ${formatNumber(buyPrice)}💎</b></div>
      <div class="market-stat"><span>🟢 Продать</span><b>1🔧 = ${formatNumber(sellPrice)}💎</b></div>
    </div>
    <div class="market-wallet polished-wallet">
      <span>💎 Ап-баланс: <b>${formatNumber(upgradeBalance)}</b></span>
      <span>🔧 Запчасти: <b>${formatNumber(parts)}</b></span>
    </div>
    <div class="market-actions pretty-actions polished-market-actions">
      <input id="marketQty" type="number" min="1" step="1" value="${lastMarketQty}" />
      <button id="marketBuyBtn" ${!canBuyOne ? 'disabled' : ''}>🔵 Купить запчасти</button>
      <button id="marketSellBtn" ${!canSellOne ? 'disabled' : ''}>🟢 Продать запчасти</button>
    </div>
    <p class="market-hint">Склад рынка общий для всех. Покупка уменьшает общий склад, продажа пополняет общий склад.</p>
  `;
  const qtyInput = document.getElementById('marketQty');
  qtyInput?.addEventListener('input', () => {
    const value = Math.max(1, Number(qtyInput.value || 1));
    lastMarketQty = value;
    localStorage.setItem('mooseFarmLastMarketQty', String(value));
  });
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}

async function offCollect() {
  if (state?.streamOnline || state?.profile?.stream_online) {
    showMessage('⛔ Во время стрима оффсбор недоступен.');
    return;
  }
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showPrettyModal({
    title: '🌙 Оффсбор получен',
    subtitle: '50% от фермы + завод / 2',
    body: `<div class="result-mini-grid"><div><span>🌾 Монеты фермы</span><b>+${formatNumber(data.income || 0)}</b></div><div><span>🔧 Запчасти завода</span><b>+${formatNumber(data.partsIncome || 0)}</b></div><div><span>⏱ За период</span><b>${formatNumber(data.minutes || 0)} мин</b></div><div><span>📥 Ферма</span><b>${formatNumber((data.passive || 0) + (data.harvest || 0))} / 2</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}🌾${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
  await loadMe();
}

async function loadTops() {
  const topsBox = document.getElementById('topsBox');
  if (!topsBox) return;
  try {
    const res = await fetch('/api/farm/top?days=14');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'top_failed');
    topsBox.dataset.loaded = '1';
    const raids = (data.raidTop || []).slice(0, 10);
    const players = (data.playerTop || []).slice(0, 10);
    topsBox.innerHTML = `
      <h3>🏆 Топы</h3>
      <div class="tops-grid pretty-tops">
        <div class="top-card"><b>🏴 Топ рейдов за ${data.days}д</b><ol>${raids.length ? raids.map((r) => `<li><span>${r.nick}</span><strong>${formatNumber(r.money)}💰 / ${formatNumber(r.bonus)}💎</strong><em>${r.attacks}⚔ · ${r.defends}🛡</em></li>`).join('') : '<li>нет рейдов</li>'}</ol></div>
        <div class="top-card top-player-wide"><b>💰 Топ игроков</b><ol>${players.length ? players.map((p) => `
          <li class="top-player-row">
            <span>${p.nick}</span>
            <strong>💰${formatNumber(ordinaryCoins(p))} / 🌾${formatNumber(farmCoins(p))} / 💎${formatNumber(bonusCoins(p))}</strong>
            <em>ур. ${p.level} · 🔧${formatNumber(p.parts)}</em>
            <div class="top-building-cells">${(p.buildings || []).length ? (p.buildings || []).map((b) => `<div class="top-building-cell"><b>${b.name || b.key}</b><span>ур. ${formatNumber(b.level)}</span><small>${buildingBenefitLabel(b)}</small></div>`).join('') : '<div class="top-building-cell empty"><b>Зданий нет</b><small>пока нет бонусов от зданий</small></div>'}</div>
          </li>`).join('') : '<li>нет игроков</li>'}</ol></div>
      </div>
    `;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}



/* === STAGE 7-12 FINAL UX PACK === */
function stageFormat(n){ return formatNumber(Number(n||0)); }
function getBuildingConf(key){ return state?.profile?.configs?.buildings?.[key] || {}; }
function calcBuildingCost(conf, level){
  return {
    coins: Number(conf.baseCost || 0) + Math.max(0, level - 1) * Number(conf.costIncreasePerLevel || 0),
    parts: Number(conf.partsBase || 0) + Math.max(0, level - 1) * Number(conf.partsPerLevel || 0)
  };
}
function buildingNextBenefit(key, conf, fromLevel, toLevel){
  const diff = Math.max(1, Number(toLevel||fromLevel+1)-Number(fromLevel||0));
  if (key === 'завод') return `даст производство 🔧: +${stageFormat((Number(conf.baseProduction||0)+Number(conf.perLevel||0)*Math.max(0,toLevel-1)))} / сбор`;
  if (key === 'фабрика') return `усилит завод примерно на +${stageFormat(Number(conf.baseProduction||0)+Number(conf.perLevel||0)*Math.max(0,toLevel-1))}%`;
  if (key === 'шахта') return `усилит бонусы шахтой: +${stageFormat(toLevel)}%`;
  if (key === 'укрепления') return `щит/укрепления: +${stageFormat(Number(conf.baseProduction||0)+Number(conf.perLevel||0)*Math.max(0,toLevel-1))}`;
  if (key === 'кузница') return `оружие для рейдов: +${stageFormat(Number(conf.baseProduction||0)+Number(conf.perLevel||0)*Math.max(0,toLevel-1))}`;
  if (key === 'центр') return `сократит кд рейда на ${stageFormat(Math.min(toLevel*5,45))} мин`;
  if (key === 'глушилка') return `снизит шанс турели цели на ${stageFormat(toLevel*5)}%`;
  if (Number(conf.coinsPerHour||0) || Number(conf.coinsPerLevel||0)) return `доход: +${stageFormat((Number(conf.coinsPerHour||0)+Number(conf.coinsPerLevel||0))*diff)}💰/ч`;
  return 'откроет/усилит механику здания';
}
function calcAffordableLevelsDetailed(conf, lvl, coins, parts, maxCount=999){
  let count=0,totalCoins=0,totalParts=0,stop='';
  let c=Number(coins||0), p=Number(parts||0);
  const maxLevel=Number(conf.maxLevel||0)||100000;
  for(let step=1; step<=maxCount; step++){
    const next=lvl+step;
    if(next>maxLevel){ stop='достигнут максимум здания'; break; }
    const cost=calcBuildingCost(conf,next);
    if(c<cost.coins){ stop=`не хватает ${stageFormat(cost.coins-c)}💰 на ${next} ур.`; break; }
    if(p<cost.parts){ stop=`не хватает ${stageFormat(cost.parts-p)}🔧 на ${next} ур.`; break; }
    c-=cost.coins; p-=cost.parts; totalCoins+=cost.coins; totalParts+=cost.parts; count++;
  }
  return {count,totalCoins,totalParts,stop,remainingCoins:c,remainingParts:p};
}
function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;
  const p = data.profile || {};
  const buildingsConfig = p.configs?.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);
  if (!keys.length) { el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>'; return; }
  el.innerHTML = `<div class="stage-section-title"><h2>🏗 Здания</h2><p>Понятные требования, стоимость, стопоры и выгода следующего уровня.</p></div>` + keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0) || 0;
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const nextLevel = lvl + 1;
    const nextCost = calcBuildingCost(conf, nextLevel);
    const st = resourceStatus(p, nextCost.coins, nextCost.parts);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
    const reason = levelLocked ? `Нужен уровень фермы ${requiredLevel}, сейчас ${farmLevel}` : maxed ? 'Здание уже на максимуме' : affordAll.stop || 'ресурсов хватает';
    return `
      <div class="building-card stage-building-card ${levelLocked ? 'locked-building' : st.coinsOk && st.partsOk ? 'ready-building' : 'shortage-building'}">
        <div class="building-title-row"><h3>${conf.name || key}</h3><span class="building-badge">${isBuilt ? `ур. ${lvl}${maxLevel ? '/' + maxLevel : ''}` : 'не построено'}</span></div>
        <div class="stage-building-meta"><span>Требование: ${requiredLevel ? `${requiredLevel} ур. фермы` : 'нет'}</span><span>Статус: ${reason}</span></div>
        <div class="stage-cost-grid"><div><span>Следующий уровень</span><b>${maxed ? 'MAX' : nextLevel + ' ур.'}</b></div><div><span>Цена</span><b>${stageFormat(nextCost.coins)}💰 / ${stageFormat(nextCost.parts)}🔧</b></div><div><span>У тебя</span><b>${stageFormat(currentCoins(p))}💰 / ${stageFormat(p.parts || 0)}🔧</b></div><div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${stageFormat(affordAll.count)} ур.`}</b></div></div>
        <div class="stage-benefit">✨ Следующий уровень даст: <b>${maxed ? 'максимум уже достигнут' : buildingNextBenefit(key, conf, lvl, nextLevel)}</b></div>
        ${!levelLocked && !maxed ? `<div class="stage-mini-note">Для +10 реально доступно: <b>${stageFormat(afford10.count)} ур.</b>, цена доступной пачки: <b>${stageFormat(afford10.totalCoins)}💰 / ${stageFormat(afford10.totalParts)}🔧</b>${afford10.stop ? ` · стопор: ${afford10.stop}` : ''}</div>` : `<div class="stage-mini-note warning">${reason}</div>`}
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}

let stageMarketHistory = [];
try { stageMarketHistory = JSON.parse(localStorage.getItem('stageMarketHistory') || '[]'); } catch (_) { stageMarketHistory = []; }
function pushMarketHistory(item){ stageMarketHistory.unshift({...item, ts:Date.now()}); stageMarketHistory=stageMarketHistory.slice(0,20); localStorage.setItem('stageMarketHistory',JSON.stringify(stageMarketHistory)); }
function renderMarket(data) {
  const box = document.getElementById('marketBox'); if (!box) return;
  const market = data.market || {}; const stock = Number(market.stock || 0); const sellPrice = Number(market.sellPrice || 10); const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {}; const upgradeBalance = Number(profile.upgrade_balance || 0); const parts = Number(profile.parts || 0);
  const qty = Math.max(1, Number(lastMarketQty || 1));
  const buyMaxByBalance = Math.floor(upgradeBalance / Math.max(1,buyPrice)); const buyMax = Math.max(0, Math.min(stock, buyMaxByBalance)); const sellMax = Math.max(0, parts);
  box.innerHTML = `
    <div class="market-hero polished-market-hero stage-market-hero"><div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех</small></div><div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>макс: ${stageFormat(buyMax)}🔧</small></div><div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>можно: ${stageFormat(sellMax)}🔧</small></div></div>
    <div class="market-wallet polished-wallet"><span>💎 Баланс: <b>${stageFormat(upgradeBalance)}</b></span><span>🔧 Запчасти: <b>${stageFormat(parts)}</b></span></div>
    <div class="market-preset-row"><button data-market-preset="1">1</button><button data-market-preset="10">10</button><button data-market-preset="100">100</button><button data-market-preset="1000">1к</button><button data-market-preset="buyMax">макс купить</button><button data-market-preset="sellMax">макс продать</button></div>
    <div class="market-actions pretty-actions polished-market-actions"><input id="marketQty" type="number" min="1" step="1" value="${qty}" /><button id="marketBuyBtn" ${buyMax < 1 ? 'disabled' : ''}>🔵 Купить</button><button id="marketSellBtn" ${sellMax < 1 ? 'disabled' : ''}>🟢 Продать</button></div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history"><b>История сделок</b>${stageMarketHistory.length ? stageMarketHistory.map(h=>`<div><span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span> ${h.action==='buy'?'🔵 куплено':'🟢 продано'} <b>${stageFormat(h.qty)}🔧</b> за <b>${stageFormat(h.cost)}💎</b></div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>'}</div>`;
  const qtyInput=document.getElementById('marketQty');
  const recalc=()=>{ const q=Math.max(1,Number(qtyInput?.value||1)); lastMarketQty=q; localStorage.setItem('mooseFarmLastMarketQty',String(q)); const buyCost=q*buyPrice; const sellGain=q*sellPrice; const warnings=[]; if(q>stock) warnings.push('покупка упрётся в общий склад'); if(buyCost>upgradeBalance) warnings.push('покупка упрётся в баланс 💎'); if(q>parts) warnings.push('продажа упрётся в твои 🔧'); const calc=document.getElementById('marketCalc'); if(calc) calc.innerHTML=`Калькулятор: купить ${stageFormat(q)}🔧 = <b>${stageFormat(buyCost)}💎</b> · продать ${stageFormat(q)}🔧 = <b>${stageFormat(sellGain)}💎</b>${warnings.length?`<br><span class="warning">⚠️ ${warnings.join(' · ')}</span>`:''}`; };
  qtyInput?.addEventListener('input', recalc); recalc();
  document.querySelectorAll('[data-market-preset]').forEach(btn=>btn.addEventListener('click',()=>{ const v=btn.dataset.marketPreset; qtyInput.value = v==='buyMax'?Math.max(1,buyMax):v==='sellMax'?Math.max(1,sellMax):v; recalc(); }));
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty'); const qty = Number(qtyInput?.value || 0);
  if (qty > 0) { lastMarketQty = qty; localStorage.setItem('mooseFarmLastMarketQty', String(qty)); }
  const data = await postJson(`/api/farm/market/${action}`, { qty });
  if (!data.ok) { const labels={invalid_quantity:'укажи количество больше 0',quantity_too_large:`слишком большое число, максимум ${stageFormat(data.maxQty||0)}🔧`,not_enough_parts:`не хватает запчастей: ${stageFormat(data.available||0)}/${stageFormat(data.needed||0)}🔧`,not_enough_upgrade_balance:`не хватает 💎: ${stageFormat(data.available||0)} / ${stageFormat(data.needed||0)}`,market_stock_empty:'общий склад пуст',not_enough_market_stock:'на общем складе недостаточно 🔧'}; showMessage(`❌ Рынок: ${labels[data.error] || data.error}`); await loadMe(); return; }
  pushMarketHistory({action, qty:data.qty||qty, cost:data.totalCost||0});
  showPrettyModal({ title: action==='buy'?'🏪 Покупка завершена':'🏪 Продажа завершена', body:`<div class="result-mini-grid"><div><span>${action==='buy'?'🔧 Куплено':'🔧 Продано'}</span><b>${stageFormat(data.qty)}🔧</b></div><div><span>${action==='buy'?'💎 Потрачено':'💎 Получено'}</span><b>${stageFormat(data.totalCost)}💎</b></div><div><span>📦 Общий склад</span><b>${stageFormat(data.market?.stock ?? 0)}🔧</b></div></div>`, autoCloseMs:7000, kind:'success' });
  showActionToast(action==='buy'?'🏪 Покупка на рынке':'🏪 Продажа на рынке',[action==='buy'?`Куплено: <b>${stageFormat(data.qty)}🔧</b>`:`Продано: <b>${stageFormat(data.qty)}🔧</b>`, action==='buy'?`Потрачено: <b>${stageFormat(data.totalCost)}💎</b>`:`Получено: <b>${stageFormat(data.totalCost)}💎</b>`],{kind:'market'});
  await loadMe();
}

function renderUnifiedReward(title, subtitle, items, opts={}){
  const body=`<div class="unified-reward-grid">${items.map(i=>`<div><span>${i.label}</span><b>${i.value}</b><small>${i.note||''}</small></div>`).join('')}</div>`;
  showPrettyModal({title, subtitle, body, autoCloseMs: opts.autoCloseMs||9000, wide:!!opts.wide, kind:opts.kind||'success'});
}

function showCaseHistoryModal(history = []) {
  const rows = history.length ? history.slice(0, 40).map((item, index)=>`<tr><td>#${index+1}</td><td>${new Date(item.date||item.timestamp||0).toLocaleString('ru-RU')}</td><td>${item.type==='parts'?'🔧 Запчасти':'💎 Бонусные'}</td><td><b>${prizeLabel(item)}</b></td><td>${stageFormat(item.cost||0)}💰</td><td>x${Number(item.multiplier||item.finalMultiplier||1).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="6">История кейсов пустая</td></tr>';
  showPrettyModal({title:'🎰 История кейсов', subtitle:'Последние открытия с типом, ценой и множителем', body:`<div class="case-table-wrap"><table class="case-history-table"><thead><tr><th>#</th><th>Дата</th><th>Тип</th><th>Приз</th><th>Цена</th><th>Множитель</th></tr></thead><tbody>${rows}</tbody></table></div>`, wide:true});
}

async function openCase() {
  const data = await postJson('/api/farm/case/open');
  if (!data.ok) { const labels={farm_level_too_low:`кейс доступен с ${data.requiredLevel||30} уровня`,cooldown:`кейс будет доступен через ${formatTime(data.remainingMs||0)}`,not_enough_money:`не хватает монет: сейчас ${stageFormat(data.available||0)} / нужно ${stageFormat(data.needed||0)}`}; showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`); await loadMe(); return; }
  showCaseOverlay(data.prize);
  renderUnifiedReward('🎰 Кейс открыт','Единый отчёт по награде',[{label:'🎁 Выигрыш',value:prizeLabel(data.prize),note:'уже с множителем'},{label:'💰 Цена',value:`${stageFormat(data.cost||0)}💰`},{label:'🧮 Множитель',value:`x${Number(data.prize?.multiplier||1).toFixed(2)}`},{label:'📦 Тип',value:data.prize?.type==='parts'?'Запчасти':'Бонусные'}],{wide:true});
  await loadMe();
}
async function claimGamus(){ const data=await postJson('/api/farm/gamus/claim'); if(!data.ok){ showMessage(data.error==='cooldown'?`⏳ GAMUS через ${formatTime(data.remainingMs||0)} (06:00 МСК)`:`❌ GAMUS: ${data.error}`); await loadMe(); return; } renderUnifiedReward('🎁 GAMUS получен','Единый отчёт по спонсору',[{label:'💎 Монеты',value:`+${stageFormat(data.money||0)}`},{label:'🔧 Запчасти',value:`+${stageFormat(data.parts||0)}`},{label:'⛏ Шахта дала',value:`+${stageFormat(data.mineBonusMoney||0)}💎 / +${stageFormat(data.mineBonusParts||0)}🔧`},{label:'📈 Тир',value:stageFormat(data.tierLevel||0)}]); await loadMe(); }
async function offCollect(){ if(state?.streamOnline || state?.profile?.stream_online){showMessage('⛔ Во время стрима оффсбор недоступен.'); return;} const data=await postJson('/api/farm/off-collect'); if(!data.ok){showMessage(data.error==='cooldown'?`⏳ Оффсбор через ${formatTime(data.remainingMs||0)}`:`❌ Оффсбор: ${data.error}`); await loadMe(); return;} renderUnifiedReward('🌙 Оффсбор получен','50% от сбора фермы + запчасти завода / 2',[{label:'🌾 Ферма',value:`+${stageFormat(data.income||0)}`},{label:'🔧 Завод',value:`+${stageFormat(data.partsIncome||0)}`},{label:'⏱ Период',value:`${stageFormat(data.minutes||0)} мин`},{label:'🧮 Формула',value:'ферма / 2 + завод / 2'}]); await loadMe(); }

function renderInfo(data){
  const infoBox=document.getElementById('infoBox'); const topsBox=document.getElementById('topsBox'); if(!infoBox) return;
  const info=data.farmInfo||{}; const raidInfo=data.raidInfo||{}; const hourly=info.hourly||{}; const balances=info.balances||{}; const buildings=info.buildings||[]; const raidLogs=(raidInfo.logs||[]).slice(0,10);
  infoBox.innerHTML=`<div class="info-grid rich-info-grid final-info-grid"><div class="info-metric"><span>💰 Голда</span><b>${stageFormat(balances.twitch||0)}</b></div><div class="info-metric"><span>🌾 Ферма</span><b>${stageFormat(balances.farm||0)}</b></div><div class="info-metric"><span>💎 Бонусные</span><b>${stageFormat(balances.upgrade||0)}</b></div><div class="info-metric"><span>🔧 Запчасти</span><b>${stageFormat(balances.parts||0)}</b></div><div class="info-metric"><span>📈 Доход/ч</span><b>${stageFormat(hourly.total||0)}</b><small>пассив ${stageFormat(hourly.passive||0)} · растения/животные ${stageFormat((hourly.plants||0)+(hourly.animals||0))} · здания ${stageFormat(hourly.buildingCoins||0)}</small></div><div class="info-metric"><span>🛠 Детали/ч</span><b>${stageFormat(hourly.parts||0)}</b></div><div class="info-metric wide"><span>🏗 Постройки</span><b>${buildings.length}</b><small>${buildings.length?buildings.map(b=>`${b.config?.name||b.key}: ${b.level} (${buildingBenefitLabel({key:b.key,name:b.config?.name,level:b.level,...b})})`).join(' · '):'нет построек'}</small></div><div class="info-metric"><span>🏴 Рейды 14д</span><b>${stageFormat(raidInfo.twoWeeks?.count||0)}</b><small>${stageFormat(raidInfo.twoWeeks?.stolen||0)}💰 · ${stageFormat(raidInfo.twoWeeks?.bonus||0)}💎</small></div></div><div class="raid-log-list beautiful-raid-log"><div class="section-inline-title">Последние рейды</div>${raidLogs.length?raidLogs.map((r,i)=>`<div class="raid-log-row"><b>${i+1}.</b> ${new Date(r.timestamp||0).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: <b>${stageFormat(r.stolen)}💰</b>, <b>${stageFormat(r.bonus_stolen||0)}💎</b>${r.killed_by_turret?' · 🔫 турель':''}</div>`).join(''):'<div class="raid-log-row">Рейдов пока нет</div>'}</div><button id="refreshTopBtn">🏆 Обновить топы</button>`;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops); if(topsBox && !topsBox.dataset.loaded) loadTops();
}
function topList(title, list, valueFn, extraFn){ return `<div class="top-card"><b>${title}</b><ol>${list.length?list.map((p,i)=>`<li><span>${i+1}. ${p.nick}</span><strong>${valueFn(p)}</strong>${extraFn?`<em>${extraFn(p)}</em>`:''}</li>`).join(''):'<li>нет данных</li>'}</ol></div>`; }
async function loadTops(){ const topsBox=document.getElementById('topsBox'); if(!topsBox) return; try{ const res=await fetch('/api/farm/top?days=14'); const data=await res.json(); if(!data.ok) throw new Error(data.error||'top_failed'); topsBox.dataset.loaded='1'; const players=(data.playerTop||[]); const raids=(data.raidTop||[]); const by=(fn)=>players.slice().sort((a,b)=>fn(b)-fn(a)).slice(0,10); const rich=players.slice(0,10); topsBox.innerHTML=`<h3>🏆 Топы и аналитика</h3><div class="tops-grid pretty-tops final-tops">${topList('💰 Топ по голде',by(p=>ordinaryCoins(p)),p=>stageFormat(ordinaryCoins(p))+'💰',p=>'ур. '+p.level)}${topList('🌾 Топ по ферме',by(p=>farmCoins(p)),p=>stageFormat(farmCoins(p))+'🌾')}${topList('💎 Топ по бонусным',by(p=>bonusCoins(p)),p=>stageFormat(bonusCoins(p))+'💎')}${topList('🔧 Топ по запчастям',by(p=>Number(p.parts||0)),p=>stageFormat(p.parts)+'🔧')}${topList('🏴 Топ рейдеров 14д',raids.slice(0,10),r=>stageFormat(r.money)+'💰 / '+stageFormat(r.bonus)+'💎',r=>`${r.attacks}⚔ · ${r.defends}🛡`)}${topList('🎰 Топ по кейсам',by(p=>Number(p.caseOpened||p.caseStats?.opened||0)),p=>stageFormat(p.caseOpened||p.caseStats?.opened||0)+' кейсов')}${topList('🔫 Урон турелей',raids.slice().sort((a,b)=>(b.blocked||0)-(a.blocked||0)).slice(0,10),r=>stageFormat(r.blocked||0)+'💰',r=>'блок/штраф')}${topList('📈 Прибыль 14д',raids.slice().sort((a,b)=>(b.money+b.bonus)-(a.money+a.bonus)).slice(0,10),r=>stageFormat((r.money||0)+(r.bonus||0)),'') }<div class="top-card top-player-wide"><b>🌟 Сильнейшие игроки</b><ol>${rich.length?rich.map((p)=>`<li class="top-player-row"><span>${p.nick}</span><strong>💰${stageFormat(ordinaryCoins(p))} / 🌾${stageFormat(farmCoins(p))} / 💎${stageFormat(bonusCoins(p))}</strong><em>ур. ${p.level} · 🔧${stageFormat(p.parts)}</em><div class="top-building-cells">${(p.buildings||[]).length?(p.buildings||[]).map(b=>`<div class="top-building-cell"><b>${b.name||b.key}</b><span>ур. ${stageFormat(b.level)}</span><small>${buildingBenefitLabel(b)}</small></div>`).join(''):'<div class="top-building-cell empty"><b>Зданий нет</b><small>пока нет бонусов</small></div>'}</div></li>`).join(''):'<li>нет игроков</li>'}</ol></div></div>`; }catch(e){ topsBox.textContent='Не удалось загрузить топы'; } }

async function renderAdminBackups(login){
  const box=document.getElementById('admin-backup-list'); if(!box || !login) return;
  try{ const data=await adminGet('backups?login='+encodeURIComponent(login)); const backups=data.backups||[]; box.innerHTML=`<div class="backup-panel"><h3>🧯 Backup / restore</h3><p>Можно восстановить весь профиль или отдельный блок.</p>${backups.length?backups.map(b=>`<div class="backup-row"><div><b>${new Date(b.createdAt||0).toLocaleString('ru-RU')}</b><small>${b.reason} · ур. ${b.level} · 🌾${stageFormat(b.farm_balance)} · 💎${stageFormat(b.upgrade_balance)} · 🔧${stageFormat(b.parts)}</small><small>Здания: ${Object.keys(b.buildings||{}).length} · кейсы: ${b.caseHistoryCount} · рейды: ${b.raidLogsCount}</small></div><div class="backup-actions"><button data-restore-index="${b.index}" data-restore-block="all">Всё</button><button data-restore-index="${b.index}" data-restore-block="balances">Балансы</button><button data-restore-index="${b.index}" data-restore-block="progression">Прогресс</button><button data-restore-index="${b.index}" data-restore-block="farm">Ферма</button></div></div>`).join(''):'<p>Бэкапов пока нет.</p>'}</div>`; box.querySelectorAll('[data-restore-index]').forEach(btn=>btn.addEventListener('click',async()=>{const index=Number(btn.dataset.restoreIndex); const block=btn.dataset.restoreBlock; const ok=await confirmFarmModal({title:'Восстановить backup?',body:`Будет восстановлен блок: <b>${block}</b><br>Backup #${index+1}. Перед восстановлением создаётся новый backup.`}); if(!ok)return; const res=await adminPost('restore-backup-index',{login,index,block}); setAdminStatus(res.message); renderAdminPlayer(res.profile); })); }catch(e){ box.innerHTML='<p class="error">Не удалось загрузить backup: '+e.message+'</p>'; }
}
const prevRenderAdminPlayer = renderAdminPlayer;
function renderAdminPlayer(profile){
  prevRenderAdminPlayer(profile);
  const box=document.getElementById('admin-player-info'); if(!box || !profile) return;
  let backupBox=document.getElementById('admin-backup-list'); if(!backupBox){ backupBox=document.createElement('div'); backupBox.id='admin-backup-list'; box.appendChild(backupBox); }
  renderAdminBackups((profile.twitch_login||profile.login||'').toLowerCase());
}


/* === HOTFIX 2026-05-03: market shorthand, buildings layout, admin stack === */
function parseHumanQty(value) {
  let raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (!raw) return 0;
  let mult = 1;
  if (raw.endsWith('кк') || raw.endsWith('kk')) { mult = 1000000; raw = raw.slice(0, -2); }
  else if (raw.endsWith('к') || raw.endsWith('k')) { mult = 1000; raw = raw.slice(0, -1); }
  else if (raw.endsWith('м') || raw.endsWith('m')) { mult = 1000000; raw = raw.slice(0, -1); }
  else if (raw.endsWith('млрд') || raw.endsWith('b')) { mult = 1000000000; raw = raw.replace(/млрд|b$/g, ''); }
  let num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num * mult);
}

function formatHumanInputValue(n) {
  n = Math.max(1, Math.floor(Number(n || 1)));
  if (n >= 1000000 && n % 1000000 === 0) return (n / 1000000) + 'кк';
  if (n >= 1000 && n % 1000 === 0) return (n / 1000) + 'к';
  return String(n);
}

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;
  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const buyMaxByBalance = Math.floor(upgradeBalance / Math.max(1, buyPrice));
  const buyMax = Math.max(0, Math.min(stock, buyMaxByBalance));
  const sellMax = Math.max(0, parts);
  const startQty = Math.max(1, Number(lastMarketQty || 1000));

  box.innerHTML = `
    <div class="market-hero polished-market-hero stage-market-hero clean-market-hero">
      <div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>макс купить: ${stageFormat(buyMax)}🔧</small></div>
      <div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>макс продать: ${stageFormat(sellMax)}🔧</small></div>
    </div>
    <div class="market-wallet polished-wallet"><span>💎 Баланс: <b>${stageFormat(upgradeBalance)}</b></span><span>🔧 Запчасти: <b>${stageFormat(parts)}</b></span></div>
    <div class="market-preset-row market-preset-row-fixed">
      <button data-market-preset="1000">1к</button>
      <button data-market-preset="10000">10к</button>
      <button data-market-preset="100000">100к</button>
      <button data-market-preset="1000000">1кк</button>
      <button data-market-preset="buyMax">макс купить</button>
      <button data-market-preset="sellMax">макс продать</button>
    </div>
    <div class="market-actions pretty-actions polished-market-actions clean-market-actions">
      <input id="marketQty" type="text" inputmode="text" value="${formatHumanInputValue(startQty)}" placeholder="1к / 100к / 1кк" />
      <button id="marketBuyBtn" ${buyMax < 1 ? 'disabled' : ''}>🔵 Купить</button>
      <button id="marketSellBtn" ${sellMax < 1 ? 'disabled' : ''}>🟢 Продать</button>
    </div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history"><b>История сделок</b>${stageMarketHistory.length ? stageMarketHistory.map(h=>`<div><span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span> ${h.action==='buy'?'🔵 куплено':'🟢 продано'} <b>${stageFormat(h.qty)}🔧</b> за <b>${stageFormat(h.cost)}💎</b></div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>'}</div>`;

  const qtyInput = document.getElementById('marketQty');
  const recalc = () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    lastMarketQty = q;
    localStorage.setItem('mooseFarmLastMarketQty', String(q));
    const buyCost = q * buyPrice;
    const sellGain = q * sellPrice;
    const warnings = [];
    if (q > stock) warnings.push(`покупка упрётся в общий склад: доступно ${stageFormat(stock)}🔧`);
    if (buyCost > upgradeBalance) warnings.push(`покупка упрётся в баланс: нужно ${stageFormat(buyCost)}💎, есть ${stageFormat(upgradeBalance)}💎`);
    if (q > parts) warnings.push(`продажа упрётся в твои запчасти: есть ${stageFormat(parts)}🔧`);
    const calc = document.getElementById('marketCalc');
    if (calc) calc.innerHTML = `Калькулятор: купить <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(buyCost)}💎</b> · продать <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(sellGain)}💎</b>${warnings.length ? `<br><span class="warning">⚠️ ${warnings.join(' · ')}</span>` : ''}`;
  };
  qtyInput?.addEventListener('input', recalc);
  qtyInput?.addEventListener('blur', () => { qtyInput.value = formatHumanInputValue(parseHumanQty(qtyInput.value)); recalc(); });
  recalc();

  document.querySelectorAll('[data-market-preset]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.marketPreset;
    const value = v === 'buyMax' ? Math.max(1, buyMax) : v === 'sellMax' ? Math.max(1, sellMax) : Number(v);
    qtyInput.value = formatHumanInputValue(value);
    recalc();
  }));
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty');
  const qty = parseHumanQty(qtyInput?.value || '0');
  if (qty > 0) {
    lastMarketQty = qty;
    localStorage.setItem('mooseFarmLastMarketQty', String(qty));
  }
  const data = await postJson(`/api/farm/market/${action}`, { qty });
  if (!data.ok) {
    const labels = {
      invalid_quantity: 'укажи количество больше 0. Можно писать 1к, 100к или 1кк',
      quantity_too_large: `слишком большое число, максимум ${stageFormat(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: ${stageFormat(data.available || 0)}/${stageFormat(data.needed || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎: ${stageFormat(data.available || 0)} / ${stageFormat(data.needed || 0)}`,
      market_stock_empty: 'общий склад пуст',
      not_enough_market_stock: 'на общем складе недостаточно 🔧'
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 });
  showPrettyModal({
    title: action === 'buy' ? '🏪 Покупка завершена' : '🏪 Продажа завершена',
    body: `<div class="result-mini-grid"><div><span>${action === 'buy' ? '🔧 Куплено' : '🔧 Продано'}</span><b>${stageFormat(data.qty)}🔧</b></div><div><span>${action === 'buy' ? '💎 Потрачено' : '💎 Получено'}</span><b>${stageFormat(data.totalCost)}💎</b></div><div><span>📦 Общий склад</span><b>${stageFormat(data.market?.stock ?? 0)}🔧</b></div></div>`,
    autoCloseMs: 7000,
    kind: 'success'
  });
  showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [
    action === 'buy' ? `Куплено: <b>${stageFormat(data.qty)}🔧</b>` : `Продано: <b>${stageFormat(data.qty)}🔧</b>`,
    action === 'buy' ? `Потрачено: <b>${stageFormat(data.totalCost)}💎</b>` : `Получено: <b>${stageFormat(data.totalCost)}💎</b>`
  ], { kind: 'market' });
  await loadMe();
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;
  const p = data.profile || {};
  const buildingsConfig = p.configs?.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);
  if (!keys.length) { el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>'; return; }
  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0) || 0;
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const nextLevel = lvl + 1;
    const nextCost = calcBuildingCost(conf, nextLevel);
    const st = resourceStatus(p, nextCost.coins, nextCost.parts);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
    const reason = levelLocked ? `нужен ${requiredLevel} ур. фермы, сейчас ${farmLevel}` : maxed ? 'здание уже на максимуме' : affordAll.stop || 'ресурсов хватает';
    const nextBenefit = maxed ? 'максимум уже достигнут' : buildingNextBenefit(key, conf, lvl, nextLevel);
    return `
      <div class="building-card stage-building-card clean-building-card ${levelLocked ? 'locked-building' : st.coinsOk && st.partsOk ? 'ready-building' : 'shortage-building'}">
        <div class="building-title-row"><h3>${conf.name || key}</h3><span class="building-badge">${isBuilt ? `ур. ${lvl}${maxLevel ? '/' + maxLevel : ''}` : 'не построено'}</span></div>
        <div class="clean-building-status"><div><span>Требование</span><b>${requiredLevel ? `${requiredLevel} ур. фермы` : 'нет'}</b></div><div><span>Статус</span><b>${reason}</b></div></div>
        <div class="clean-cost-grid"><div><span>Следующий</span><b>${maxed ? 'MAX' : nextLevel + ' ур.'}</b></div><div><span>Цена</span><b>${stageFormat(nextCost.coins)}💰<br>${stageFormat(nextCost.parts)}🔧</b></div><div><span>У тебя</span><b>${stageFormat(currentCoins(p))}💰<br>${stageFormat(p.parts || 0)}🔧</b></div><div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${stageFormat(affordAll.count)} ур.`}</b></div></div>
        <div class="stage-benefit">✨ Следующий уровень: <b>${nextBenefit}</b></div>
        ${!levelLocked && !maxed ? `<div class="stage-mini-note">Для +10 реально доступно: <b>${stageFormat(afford10.count)} ур.</b>; цена доступной пачки: <b>${stageFormat(afford10.totalCoins)}💰 / ${stageFormat(afford10.totalParts)}🔧</b>${afford10.stop ? `; стопор: ${afford10.stop}` : ''}</div>` : `<div class="stage-mini-note warning">${reason}</div>`}
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}

function renderAdminPlayer(profile) {
  const box = document.getElementById("admin-player-info");
  if (!box) return;
  if (!profile) { box.innerHTML = ""; return; }
  const login = (profile.twitch_login || profile.login || '').toLowerCase();
  box.innerHTML = `
    <div class="admin-player-card pretty-admin-player clean-admin-player">
      <div class="admin-player-top"><b>${login || 'unknown'}</b><span>ур. ${profile.level ?? 0}</span></div>
      <div class="admin-profile-grid">
        <div class="admin-mini-card"><span>🌾 Баланс фермы</span><b>${stageFormat(profile.farm_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="farm" placeholder="+1000 / -1000"><button data-admin-quick-action="give-farm-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>💎 Бонусные</span><b>${stageFormat(profile.upgrade_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="upgrade" placeholder="+1кк / -500к"><button data-admin-quick-action="give-upgrade-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>🔧 Запчасти</span><b>${stageFormat(profile.parts ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="parts" placeholder="+1000 / -1000"><button data-admin-quick-action="give-parts">Применить</button></div></div>
        <div class="admin-mini-card"><span>🌾 Уровень</span><b>${stageFormat(profile.level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="level" placeholder="120"><button data-admin-quick-action="set-level">Применить</button></div></div>
        <div class="admin-mini-card"><span>🛡 Защита</span><b>${stageFormat(profile.protection_level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="protection" placeholder="0-120"><button data-admin-quick-action="set-protection">Применить</button></div></div>
        <div class="admin-mini-card"><span>⚔️ Рейд-сила</span><b>${stageFormat(profile.raid_power ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="raid" placeholder="0-200"><button data-admin-quick-action="set-raid-power">Применить</button></div></div>
        <div class="admin-mini-card"><span>🎟 Лицензия</span><b>${stageFormat(profile.license_level ?? 0)}</b><small>редактирование через уровни/профиль</small></div>
      </div>
      <div class="admin-player-actions-row"><button type="button" data-admin-refresh-player>Обновить игрока</button><button type="button" data-admin-sync-player>Импорт из WizeBot</button><button type="button" data-admin-push-player>Пуш в WizeBot</button></div>
      <div id="admin-backup-list"></div>
    </div>
  `;
  box.querySelector('[data-admin-refresh-player]')?.addEventListener('click', () => refreshAdminPlayer().catch((e) => setAdminStatus(e.message, true)));
  box.querySelector('[data-admin-sync-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('sync-from-wizebot', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelector('[data-admin-push-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('push-to-wizebot', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelectorAll('[data-admin-quick-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const action = btn.getAttribute('data-admin-quick-action');
        const keyMap = { 'give-farm-balance': 'farm', 'give-upgrade-balance': 'upgrade', 'give-parts': 'parts', 'set-level': 'level', 'set-protection': 'protection', 'set-raid-power': 'raid' };
        const key = keyMap[action];
        const value = box.querySelector(`[data-admin-quick-input="${key}"]`)?.value;
        const body = { login };
        if (action === 'give-farm-balance' || action === 'give-upgrade-balance' || action === 'give-parts') body.amount = value;
        if (action === 'set-level' || action === 'set-protection' || action === 'set-raid-power') body.level = value;
        const data = await adminPost(action, body);
        renderAdminPlayer(data.profile);
        setAdminStatus(data.message);
      } catch (e) { setAdminStatus(e.message, true); }
    });
  });
  renderAdminBackups(login);
}


/* === HOTFIX: strict market + clean combat + readable buildings/info === */
function marketCanBuyQty(q, stock, buyPrice, upgradeBalance) {
  q = Number(q || 0);
  const maxByBalance = Math.floor(Number(upgradeBalance || 0) / Math.max(1, Number(buyPrice || 1)));
  return {
    ok: q > 0 && q <= Number(stock || 0) && q <= maxByBalance,
    maxCanBuy: Math.max(0, Math.min(Number(stock || 0), maxByBalance)),
    maxByBalance
  };
}

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;

  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / Math.max(1, buyPrice))));
  const maxSell = Math.max(0, parts);
  const startQty = Math.max(1, Number(lastMarketQty || 1000));

  box.innerHTML = `
    <div class="market-hero clean-market-hero strict-market-hero">
      <div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>можешь купить: ${stageFormat(maxBuy)}🔧</small></div>
      <div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>можешь продать: ${stageFormat(maxSell)}🔧</small></div>
    </div>
    <div class="market-wallet polished-wallet"><span>💎 Баланс: <b>${stageFormat(upgradeBalance)}</b></span><span>🔧 Запчасти: <b>${stageFormat(parts)}</b></span></div>
    <div class="market-preset-row market-preset-row-fixed">
      <button data-market-preset="1000">1к</button>
      <button data-market-preset="10000">10к</button>
      <button data-market-preset="100000">100к</button>
      <button data-market-preset="1000000">1кк</button>
      <button data-market-preset="buyMax">макс купить</button>
      <button data-market-preset="sellMax">макс продать</button>
    </div>
    <div class="market-actions pretty-actions polished-market-actions clean-market-actions">
      <input id="marketQty" type="text" inputmode="text" value="${formatHumanInputValue(startQty)}" placeholder="1к / 100к / 1кк / 100кк" />
      <button id="marketBuyBtn" ${maxBuy < 1 ? 'disabled' : ''}>🔵 Купить</button>
      <button id="marketSellBtn" ${maxSell < 1 ? 'disabled' : ''}>🟢 Продать</button>
    </div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history"><b>История сделок</b>${stageMarketHistory.length ? stageMarketHistory.map(h=>`<div><span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span> ${h.action==='buy'?'🔵 куплено':'🟢 продано'} <b>${stageFormat(h.qty)}🔧</b> за <b>${stageFormat(h.cost)}💎</b></div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>'}</div>
  `;

  const qtyInput = document.getElementById('marketQty');
  const buyBtn = document.getElementById('marketBuyBtn');
  const sellBtn = document.getElementById('marketSellBtn');

  const recalc = () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    lastMarketQty = q;
    localStorage.setItem('mooseFarmLastMarketQty', String(q));
    const buyCost = q * buyPrice;
    const sellGain = q * sellPrice;
    const buyCheck = marketCanBuyQty(q, stock, buyPrice, upgradeBalance);
    const canSellExact = q > 0 && q <= parts;
    const warnings = [];

    if (!buyCheck.ok) warnings.push(`купить ${stageFormat(q)}🔧 нельзя: максимум доступно ${stageFormat(buyCheck.maxCanBuy)}🔧`);
    if (!canSellExact) warnings.push(`продать ${stageFormat(q)}🔧 нельзя: максимум доступно ${stageFormat(parts)}🔧`);

    if (buyBtn) buyBtn.disabled = !buyCheck.ok;
    if (sellBtn) sellBtn.disabled = !canSellExact;

    const calc = document.getElementById('marketCalc');
    if (calc) {
      calc.innerHTML =
        `Калькулятор: купить <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(buyCost)}💎</b> · продать <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(sellGain)}💎</b><br>` +
        `<span class="${buyCheck.ok ? 'okline' : 'warning'}">${buyCheck.ok ? '✅ Покупка доступна ровно на это количество.' : `⚠️ Покупка не выполнится. Укажи не больше ${stageFormat(buyCheck.maxCanBuy)}🔧.`}</span>` +
        `${!canSellExact ? `<br><span class="warning">⚠️ Продажа не выполнится. Укажи не больше ${stageFormat(parts)}🔧.</span>` : ''}`;
    }
  };
  qtyInput?.addEventListener('input', recalc);
  qtyInput?.addEventListener('blur', () => { qtyInput.value = formatHumanInputValue(parseHumanQty(qtyInput.value)); recalc(); });
  recalc();

  document.querySelectorAll('[data-market-preset]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.marketPreset;
    const value = v === 'buyMax' ? Math.max(1, maxBuy) : v === 'sellMax' ? Math.max(1, maxSell) : Number(v);
    qtyInput.value = formatHumanInputValue(value);
    recalc();
  }));
  buyBtn?.addEventListener('click', () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    const check = marketCanBuyQty(q, stock, buyPrice, upgradeBalance);
    if (!check.ok) {
      showMessage(`❌ Рынок: купить ${stageFormat(q)}🔧 нельзя. Максимум сейчас ${stageFormat(check.maxCanBuy)}🔧. Укажи верное количество.`);
      return;
    }
    marketTrade('buy');
  });
  sellBtn?.addEventListener('click', () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    if (q > parts) {
      showMessage(`❌ Рынок: продать ${stageFormat(q)}🔧 нельзя. У тебя только ${stageFormat(parts)}🔧.`);
      return;
    }
    marketTrade('sell');
  });
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty');
  const qty = parseHumanQty(qtyInput?.value || '0');
  if (qty > 0) {
    lastMarketQty = qty;
    localStorage.setItem('mooseFarmLastMarketQty', String(qty));
  }
  const data = await postJson(`/api/farm/market/${action}`, { qty });
  if (!data.ok) {
    const labels = {
      invalid_quantity: 'укажи количество больше 0. Можно писать 1к, 100к или 1кк',
      quantity_too_large: `слишком большое число, максимум ${stageFormat(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: можно продать максимум ${stageFormat(data.available || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎: можно купить максимум ${stageFormat(data.maxCanBuy || 0)}🔧. Нужно ${stageFormat(data.needed || 0)}💎, есть ${stageFormat(data.available || 0)}💎`,
      market_stock_empty: 'общий склад пуст',
      not_enough_market_stock: `на общем складе недостаточно 🔧: можно купить максимум ${stageFormat(data.maxCanBuy || data.stock || 0)}🔧`
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }

  pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 });
  showPrettyModal({
    title: action === 'buy' ? '🏪 Покупка завершена' : '🏪 Продажа завершена',
    body: `<div class="result-mini-grid"><div><span>${action === 'buy' ? '🔧 Куплено' : '🔧 Продано'}</span><b>${stageFormat(data.qty)}🔧</b></div><div><span>${action === 'buy' ? '💎 Потрачено' : '💎 Получено'}</span><b>${stageFormat(data.totalCost)}💎</b></div><div><span>📦 Общий склад</span><b>${stageFormat(data.market?.stock ?? 0)}🔧</b></div></div>`,
    autoCloseMs: 7000,
    kind: 'success'
  });
  showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [
    action === 'buy' ? `Куплено: <b>${stageFormat(data.qty)}🔧</b>` : `Продано: <b>${stageFormat(data.qty)}🔧</b>`,
    action === 'buy' ? `Потрачено: <b>${stageFormat(data.totalCost)}💎</b>` : `Получено: <b>${stageFormat(data.totalCost)}💎</b>`
  ], { kind: 'market' });
  await loadMe();
}

function buildingLongBenefit(key, conf, lvl) {
  key = String(key || '').toLowerCase();
  const level = Number(lvl || 0);
  if (key === 'завод') return `производит запчасти: ${stageFormat((Number(conf.baseProduction||0) + Math.max(0, level - 1) * Number(conf.perLevel||0)))}🔧/ч`;
  if (key === 'фабрика') return `усиливает производство запчастей на ${stageFormat((Number(conf.baseProduction||0) + Math.max(0, level - 1) * Number(conf.perLevel||0)))}%`;
  if (key === 'шахта') return `умножает запчасти, кейсы и GAMUS: +${stageFormat(level)}%`;
  if (key === 'кузница') return `даёт оружие для рейдов: +${stageFormat((Number(conf.baseProduction||0) + Math.max(0, level - 1) * Number(conf.perLevel||0)))}⚔/сбор`;
  if (key === 'укрепления') return `даёт щиты защиты: +${stageFormat((Number(conf.baseProduction||0) + Math.max(0, level - 1) * Number(conf.perLevel||0)))}🛡/сбор`;
  if (key === 'глушилка') return `снижает шанс турели цели: -${stageFormat(level * 5)}%`;
  if (key === 'центр') return `снижает кулдаун рейда: -${stageFormat(Math.min(level * 5, 45))} мин`;
  return conf.description || 'улучшает ферму';
}

function renderInfo(data){
  const infoBox=document.getElementById('infoBox'); const topsBox=document.getElementById('topsBox'); if(!infoBox) return;
  const info=data.farmInfo||{}; const raidInfo=data.raidInfo||{}; const hourly=info.hourly||{}; const balances=info.balances||{}; const buildings=info.buildings||[]; const raidLogs=(raidInfo.logs||[]).slice(0,10);
  const buildingCells = buildings.length
    ? buildings.map((b)=>`<div class="info-building-cell"><b>${b.config?.name || b.key}</b><span>ур. ${stageFormat(b.level || 0)}</span><small>${buildingLongBenefit(b.key, b.config || {}, b.level || 0)}</small></div>`).join('')
    : '<div class="info-building-cell"><b>Построек нет</b><span>—</span><small>Построй здания во вкладке зданий.</small></div>';
  infoBox.innerHTML=`<div class="info-grid rich-info-grid final-info-grid"><div class="info-metric"><span>💰 Голда</span><b>${stageFormat(balances.twitch||0)}</b></div><div class="info-metric"><span>🌾 Ферма</span><b>${stageFormat(balances.farm||0)}</b></div><div class="info-metric"><span>💎 Бонусные</span><b>${stageFormat(balances.upgrade||0)}</b></div><div class="info-metric"><span>🔧 Запчасти</span><b>${stageFormat(balances.parts||0)}</b></div><div class="info-metric"><span>📈 Доход/ч</span><b>${stageFormat(hourly.total||0)}</b><small>пассив ${stageFormat(hourly.passive||0)} · растения/животные ${stageFormat((hourly.plants||0)+(hourly.animals||0))} · здания ${stageFormat(hourly.buildingCoins||0)}</small></div><div class="info-metric"><span>🛠 Детали/ч</span><b>${stageFormat(hourly.parts||0)}</b></div><div class="info-metric"><span>🏴 Рейды 14д</span><b>${stageFormat(raidInfo.twoWeeks?.count||0)}</b><small>${stageFormat(raidInfo.twoWeeks?.stolen||0)}💰 · ${stageFormat(raidInfo.twoWeeks?.bonus||0)}💎</small></div></div><div class="info-buildings-panel"><h3>🏗 Постройки</h3><div class="info-building-grid">${buildingCells}</div></div><div class="raid-log-list beautiful-raid-log"><div class="section-inline-title">Последние рейды</div>${raidLogs.length?raidLogs.map((r,i)=>`<div class="raid-log-row"><b>${i+1}.</b> ${new Date(r.timestamp||0).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: <b>${stageFormat(r.stolen)}💰</b>, <b>${stageFormat(r.bonus_stolen||0)}💎</b>${r.killed_by_turret?' · 🔫 турель':''}</div>`).join(''):'<div class="raid-log-row">Рейдов пока нет</div>'}</div><button id="refreshTopBtn">🏆 Обновить топы</button>`;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops); if(topsBox && !topsBox.dataset.loaded) loadTops();
}

function renderCombat(data) {
  const box = document.getElementById('combatBox');
  if (!box) return;
  const p = data.profile || {};
  const raidPower = data.raidUpgrades?.raidPower || {};
  const protection = data.raidUpgrades?.protection || {};
  const turret = data.turret || {};
  box.innerHTML = `
    <div class="combat-card">
      <h3>⚔️ Рейд-сила</h3>
      <p>Уровень: <b>${stageFormat(raidPower.level || 0)}/${stageFormat(raidPower.maxLevel || 200)}</b></p>
      <p>Цена следующего: <b>${raidPower.nextCost ? stageFormat(raidPower.nextCost) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${stageFormat(p.upgrade_balance || 0)}💎</b></p>
      <div class="building-actions"><button data-raid-power="1" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +1</button><button data-raid-power="10" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +10</button></div>
      ${!raidPower.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>
    <div class="combat-card">
      <h3>🛡 Защита</h3>
      <p>Уровень: <b>${stageFormat(protection.level || 0)}/${stageFormat(protection.maxLevel || 120)}</b> (${Number(protection.percent || 0).toFixed(1)}%)</p>
      <p>Цена следующего: <b>${protection.nextCost ? stageFormat(protection.nextCost) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${stageFormat(p.upgrade_balance || 0)}💎</b></p>
      <div class="building-actions"><button data-protection="1" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +1</button><button data-protection="10" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +10</button></div>
      ${!protection.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>
    <div class="combat-card">
      <h3>🔫 Турель</h3>
      <p>Уровень: <b>${stageFormat(turret.level || 0)}/${stageFormat(turret.maxLevel || 20)}</b> | шанс: <b>${stageFormat(turret.chance || 0)}%</b></p>
      <p>Следующий: <b>${turret.nextUpgrade ? stageFormat(turret.nextUpgrade.chance || 0) + '% за ' + stageFormat(turret.nextUpgrade.cost || 0) + '💰 / ' + stageFormat(turret.nextUpgrade.parts || 0) + '🔧' : 'максимум'}</b></p>
      <p class="resource-line">У тебя: <b>${stageFormat(currentCoins(p))}💰</b> / <b>${stageFormat(p.parts || 0)}🔧</b></p>
      <button id="turretUpgradeBtn" ${turret.nextUpgrade ? '' : 'disabled'}>🔫 Улучшить турель</button>
    </div>
  `;
  document.querySelectorAll('[data-raid-power]').forEach((btn) => btn.addEventListener('click', () => upgradeRaidPower(Number(btn.dataset.raidPower || 1))));
  document.querySelectorAll('[data-protection]').forEach((btn) => btn.addEventListener('click', () => upgradeProtection(Number(btn.dataset.protection || 1))));
  document.getElementById('turretUpgradeBtn')?.addEventListener('click', upgradeTurret);
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;
  const p = data.profile || {};
  const buildingsConfig = p.configs?.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);
  if (!keys.length) { el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>'; return; }
  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0) || 0;
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const nextLevel = lvl + 1;
    const nextCost = calcBuildingCost(conf, nextLevel);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
    const reason = levelLocked ? `Нужен ${requiredLevel} уровень фермы, сейчас ${farmLevel}.` : maxed ? 'Здание уже на максимуме.' : affordAll.stop || 'Можно улучшать.';
    const nextBenefit = maxed ? 'максимум уже достигнут' : buildingNextBenefit(key, conf, lvl, nextLevel);
    const haveText = `${stageFormat(currentCoins(p))}💰 / ${stageFormat(p.parts || 0)}🔧`;
    return `
      <div class="building-card stage-building-card clean-building-card readable-building-card ${levelLocked ? 'locked-building' : 'ready-building'}">
        <div class="building-title-row">
          <h3>${conf.name || key}</h3>
          <span class="building-badge">${isBuilt ? `ур. ${lvl}${maxLevel ? '/' + maxLevel : ''}` : 'не построено'}</span>
        </div>
        <div class="building-info-line"><span>Требование</span><b>${requiredLevel ? `${requiredLevel} ур. фермы` : 'нет'}</b></div>
        <div class="building-info-line"><span>Статус</span><b>${reason}</b></div>
        <div class="building-info-line"><span>Следующий уровень</span><b>${maxed ? 'MAX' : nextLevel + ' ур.'}</b></div>
        <div class="building-cost-readable">
          <div><span>Цена</span><b>${stageFormat(nextCost.coins)}💰</b><b>${stageFormat(nextCost.parts)}🔧</b></div>
          <div><span>У тебя</span><b>${haveText}</b></div>
          <div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${stageFormat(affordAll.count)} ур.`}</b></div>
        </div>
        <div class="stage-benefit">✨ Следующий уровень: <b>${nextBenefit}</b></div>
        <div class="${afford10.count > 0 ? 'stage-mini-note' : 'stage-mini-note warning'}">Для +10 реально доступно: <b>${stageFormat(afford10.count)} ур.</b>; цена доступной пачки: <b>${stageFormat(afford10.totalCoins)}💰 / ${stageFormat(afford10.totalParts)}🔧</b>${afford10.stop ? `; стопор: ${afford10.stop}` : ''}</div>
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}
