/* Moose Farm frontend split module: UI overrides: модалки, улучшенный рендер, история
   Safe-refactor: extracted from public/app.js without logic changes. */
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

  const profile = data?.profile || {};
  const currentLevel = Number(profile.license_level || 0);
  const next = data?.nextLicense || null;
  const nextLevel = Number(next?.level || 0);
  const nextCost = Number(next?.cost || 0);
  const invalidNext = !next || !Number.isFinite(nextLevel) || nextLevel <= currentLevel || nextCost <= 0;

  if (invalidNext) {
    box.innerHTML = '';
    box.style.display = 'none';
    box.classList.add('hidden');
    return;
  }

  box.style.display = '';
  box.classList.remove('hidden');
  const st = resourceStatus(profile, nextCost, 0);
  box.innerHTML = `
    <div class="license-card compact-license-card">
      <h2>🎟 Лицензии</h2>
      <p>Сейчас открыто до: <b>${currentLevel || 39}</b> уровня</p>
      <p>Следующая лицензия: <b>${nextLevel}</b> уровень</p>
      <p>Цена: <b>${formatNumber(nextCost)}💰</b></p>
      <p class="resource-line">У тебя: <b>${formatNumber(st.coins)}💰</b>${st.coinsOk ? ' ✅' : ` ❌ не хватает ${formatNumber(st.missingCoins)}💰`}</p>
      <button id="buyLicenseBtn">🎟 Купить лицензию до ${nextLevel}</button>
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
    try { const data = await adminPost('import-legacy-farm', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
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
