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
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}м ${String(s).padStart(2, '0')}с`;
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

function currentCoins(profile) {
  return Number(profile?.farm_balance || 0) + Number(profile?.upgrade_balance || 0);
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
      <span>💰 Доступно для трат: <b>${formatNumber(coins)}</b></span>
      <span>🌾 Ферма: <b>${formatNumber(profile.farm_balance)}</b></span>
      <span>💎 Ап-баланс: <b>${formatNumber(profile.upgrade_balance)}</b></span>
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
  const syncText = p.last_wizebot_sync_at
    ? new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU')
    : 'ещё не было';
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
        <div class="stat-tile"><span>💰 Доступно для трат</span><b>${formatNumber(totalCoins)}</b></div>
        <div class="stat-tile"><span>🌾 Ферма</span><b>${formatNumber(p.farm_balance)}</b></div>
        <div class="stat-tile"><span>💎 Ап-баланс</span><b>${formatNumber(p.upgrade_balance)}</b></div>
        <div class="stat-tile"><span>🔧 Запчасти</span><b>${formatNumber(p.parts)}</b></div>
        <div class="stat-tile"><span>📈 Доход</span><b>${formatNumber(p.total_income)}</b></div>
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
  const data = await postJson('/api/farm/collect');

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
      <div><b>💰 Балансы</b><br>🌾 ${formatNumber(balances.farm || 0)} / 💎 ${formatNumber(balances.upgrade || 0)} / 🔧 ${formatNumber(balances.parts || 0)}</div>
      <div><b>📈 Доход/ч</b><br>Всего: ${formatNumber(hourly.total || 0)} | пассив ${formatNumber(hourly.passive || 0)} | урожай ${formatNumber((hourly.plants || 0) + (hourly.animals || 0))} | здания ${formatNumber(hourly.buildingCoins || 0)}</div>
      <div><b>🏗 Здания</b><br>${buildings.length ? buildings.map((b) => `${b.config?.name || b.key}: ${b.level}`).join(' | ') : 'нет'}</div>
      <div><b>🏴 Рейды</b><br>За 14д: ${formatNumber(raidInfo.twoWeeks?.stolen || 0)}💰 / ${formatNumber(raidInfo.twoWeeks?.bonus || 0)}💎 / ${formatNumber(raidInfo.twoWeeks?.count || 0)} шт.</div>
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
      <div class="tops-grid">
        <div><b>🏴 Топ рейдов за ${data.days}д</b><ol>${raids.length ? raids.map((r) => `<li>${r.nick}: ${formatNumber(r.money)}💰 / ${formatNumber(r.bonus)}💎 (${r.attacks}⚔/${r.defends}🛡)</li>`).join('') : '<li>нет рейдов</li>'}</ol></div>
        <div><b>💰 Топ игроков</b><ol>${players.length ? players.map((p) => `<li>${p.nick}: ${formatNumber(p.total)}💰 | ур. ${p.level} | 🔧${formatNumber(p.parts)}</li>`).join('') : '<li>нет игроков</li>'}</ol></div>
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
