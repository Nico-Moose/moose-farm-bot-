function ensureMainActionButtons(data) {
  const grid = document.querySelector('.action-grid-top');
  if (!grid) return;
  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) collectBtn.style.display = 'none';

  let raidActionBtn = document.getElementById('raidActionBtn');
  if (!raidActionBtn) {
    raidActionBtn = document.createElement('button');
    raidActionBtn.id = 'raidActionBtn';
    raidActionBtn.className = 'compact-action compact-action-raid danger-lite';
    grid.prepend(raidActionBtn);
    raidActionBtn.addEventListener('click', doRaid);
  }

  const raid = data.raid || {};
  const streamOnline = !!(data.streamOnline || data.profile?.stream_online);
  const farmActive = !!(data && data.hasFarm);
  const raidReady = !raid.remainingMs;
  raidActionBtn.disabled = !farmActive || !streamOnline || !raid.unlocked || !raidReady;
  raidActionBtn.innerHTML = !farmActive
    ? '🏴 Рейд<br><small>ферма не активна</small>'
    : (raid.unlocked
      ? `🏴 Рейд<br><small>${!streamOnline ? 'только когда стрим онлайн' : (raidReady ? 'готов к атаке' : 'кд ' + formatTime(raid.remainingMs))}</small>`
      : '🏴 Рейд<br><small>с 30 уровня</small>');

  const upgrade1Btn = document.getElementById('upgrade1Btn');
  const upgrade10Btn = document.getElementById('upgrade10Btn');
  if (upgrade1Btn) {
    upgrade1Btn.classList.add('compact-action', 'compact-action-upgrade', 'compact-action-upgrade-one');
    upgrade1Btn.disabled = !farmActive;
    upgrade1Btn.innerHTML = `⬆️ Ап +1<br><small id="upgrade1Text">${farmActive ? (data.nextUpgrade ? formatNumber(data.nextUpgrade.cost) + '💰' + (data.nextUpgrade.parts ? ' / ' + formatNumber(data.nextUpgrade.parts) + '🔧' : '') : 'максимум') : 'ферма не активна'}</small>`;
  }
  if (upgrade10Btn) {
    upgrade10Btn.classList.add('compact-action', 'compact-action-upgrade', 'compact-action-upgrade-ten');
    upgrade10Btn.disabled = !farmActive;
    upgrade10Btn.innerHTML = farmActive
      ? '🚀 Ап +10<br><small>до 10 уровней</small>'
      : '🚀 Ап +10<br><small>ферма не активна</small>';
  }
}

function render(data) {
  state = data;
  const el = document.getElementById('profile');
  const p = data.profile || {};
  const farmActive = !!(data && data.hasFarm);
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
          <div class="profile-status-pill">${farmActive ? (data.nextUpgrade ? '✅ Ферма активна' : '✅ Максимальный уровень') : '⚪ Ферма не активна'}</div>
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
  const farmActive = !!(data && data.hasFarm);
  if (!box) {
    box = document.createElement('section');
    box.id = 'quickStatus';
    box.className = 'quick-status';
    document.getElementById('profile')?.insertAdjacentElement('afterend', box);
  }
  let upgradeText = farmActive ? '✅ Ферма уже на максимальном уровне' : 'Ферма удалена или не активна. Купи ферму заново.';
  if (farmActive && next) {
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
  const farmActive = !!(data && data.hasFarm);
  const gold = ordinaryCoins(p);
  const missingGold = Math.max(0, Number(next.cost || 0) - gold);
  const goldOk = missingGold <= 0;
  box.innerHTML = `
    <div class="license-card compact-license-card">
      <h2>🎟 Лицензии</h2>
      <p>Сейчас открыто до: <b>${p.license_level ? p.license_level : 39}</b> уровня</p>
      <p>Следующая лицензия: <b>${next.level}</b> уровень</p>
      <p>Цена: <b>${formatNumber(next.cost)}💰</b></p>
      <p class="resource-line">У тебя голды: <b>${formatNumber(gold)}💰</b>${goldOk ? ' ✅' : ` ❌ не хватает ${formatNumber(missingGold)}💰`}</p>
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
  const farmActive = !!(data && data.hasFarm);
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
  const farmActive = !!(data && data.hasFarm);
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
  const farmActive = !!(data && data.hasFarm);
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

