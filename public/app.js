let state = null;

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
      <span>💰 Всего монет: <b>${formatNumber(coins)}</b></span>
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

  el.innerHTML = `
    <div class="profile">
      ${data.user.avatarUrl ? `<img src="${data.user.avatarUrl}" alt="avatar">` : ''}
      <div>
        <b>${data.user.displayName}</b><br>
        🌾 Уровень фермы: <b>${p.level}</b><br>
        💰 Баланс фермы: <b>${formatNumber(p.farm_balance)}</b><br>
        💎 Ап-баланс: <b>${formatNumber(p.upgrade_balance)}</b><br>
        🔧 Запчасти: <b>${formatNumber(p.parts)}</b><br>
        📈 Доход всего: <b>${formatNumber(p.total_income)}</b><br>
        🛡 Защита: <b>${formatNumber(p.protection_level || 0)}</b><br>
        ⚔️ Рейд-сила: <b>${formatNumber(p.raid_power || 0)}</b><br>
        🎟 Лицензия до: <b>${p.license_level ? p.license_level : 39}</b><br>
        ${p.last_wizebot_sync_at
          ? `🔄 WizeBot sync: <b>${new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU')}</b><br>`
          : '🔄 WizeBot sync: <b>ещё не было</b><br>'}
        ${next
          ? `⬆️ Следующий уровень ${next.level}: <b>${formatNumber(next.cost)}</b>${next.parts ? ` / 🔧${formatNumber(next.parts)}` : ''}${next.licenseRequired ? ` <span class="warn">(нужна лицензия)</span>` : ''}`
          : '✅ Максимальный уровень'}
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

  box.innerHTML = `
    <p>📦 Склад рынка: <b>${formatNumber(stock)}🔧</b></p>
    <p>🟢 Продажа: <b>1🔧 = ${formatNumber(sellPrice)}💎</b> | 🔵 Покупка: <b>1🔧 = ${formatNumber(buyPrice)}💎</b></p>
    <p class="resource-line">У тебя: <b>${formatNumber(data.profile.upgrade_balance)}💎</b> / <b>${formatNumber(data.profile.parts)}🔧</b></p>
    <div class="market-actions">
      <input id="marketQty" type="number" min="1" step="1" value="100" />
      <button id="marketBuyBtn">🔵 Купить 🔧</button>
      <button id="marketSellBtn">🟢 Продать 🔧</button>
    </div>
  `;

  document.getElementById('marketBuyBtn').addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn').addEventListener('click', () => marketTrade('sell'));
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;

  const p = data.profile;
  const configs = p.configs || {};
  const buildingsConfig = configs.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);

  if (!keys.length) {
    el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>';
    return;
  }

  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key];
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0);
    const buyCoins = Number(conf.baseCost || 0);
    const buyParts = Number(conf.partsBase || 0);
    const nextLevel = lvl + 1;
    const upgradeCoins = buyCoins + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
    const upgradeParts = buyParts + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    const shownCoins = isBuilt ? upgradeCoins : buyCoins;
    const shownParts = isBuilt ? upgradeParts : buyParts;
    const st = resourceStatus(p, shownCoins, shownParts);
    const shortage = [];
    if (!st.coinsOk) shortage.push(`💰-${formatNumber(st.missingCoins)}`);
    if (!st.partsOk) shortage.push(`🔧-${formatNumber(st.missingParts)}`);

    return `
      <div class="building-card">
        <h3>${conf.name || key}</h3>
        <p>${isBuilt ? `<b>ур. ${lvl}/${maxLevel}</b>` : '<b>не построено</b>'}</p>
        <p>${isBuilt ? `Следующий ап до <b>${nextLevel}</b> ур.` : 'Покупка здания'}</p>
        <p>Цена: <b>${formatNumber(shownCoins)}💰</b> / <b>${formatNumber(shownParts)}🔧</b></p>
        <p class="resource-line">У тебя: <b>${formatNumber(st.coins)}💰</b> / <b>${formatNumber(st.parts)}🔧</b></p>
        ${shortage.length ? `<p class="shortage">Не хватает: ${shortage.join(' / ')}</p>` : '<p class="okline">Ресурсов хватает ✅</p>'}
        <p>Доступно с ур. фермы: <b>${conf.levelRequired || 0}</b></p>
        ${!isBuilt
          ? `<button data-building-buy="${key}" data-required-level="${conf.levelRequired || 0}">🏗 Купить</button>`
          : `
            <div class="building-actions">
              <button data-building-upgrade="${key}" data-count="1" ${lvl >= maxLevel ? 'disabled' : ''}>⬆️ Ап +1</button>
              <button data-building-upgrade="${key}" data-count="10" ${lvl >= maxLevel ? 'disabled' : ''}>⬆️ Ап +10</button>
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
    const data = await res.json();
    render(data);
  } catch (error) {
    document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
    console.error(error);
  }
}

async function postJson(url, body = {}) {
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
  const qty = Number(document.getElementById('marketQty')?.value || 0);
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
  } else {
    showMessage(`🟢 Продано ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎`);
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

document.getElementById('testBalanceBtn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/test-balance');
  showMessage(`💰 Добавлено ${formatNumber(data.amount)} тестовых монет.`);
  await loadMe();
});

document.getElementById('syncWizebotBtn').addEventListener('click', async () => {
  showMessage('🔄 Синхронизация запускается через команду !синкферма в Twitch-чате.');
});

loadMe();
