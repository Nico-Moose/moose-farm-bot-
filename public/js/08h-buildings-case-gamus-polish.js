/* Split from 08-feature-overrides.js. Logic unchanged. */
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


/* === HOTFIX: exact case roulette winner + multiplied prizes === */
const CASE_PRIZES_UI_FULL = [
  { type: 'coins', value: 150000 }, { type: 'parts', value: 12500 }, { type: 'coins', value: 125000 }, { type: 'parts', value: 19000 }, { type: 'coins', value: 110000 },
  { type: 'parts', value: 15000 }, { type: 'coins', value: 180000 }, { type: 'parts', value: 17000 }, { type: 'coins', value: 135000 }, { type: 'parts', value: 13500 },
  { type: 'coins', value: 145000 }, { type: 'parts', value: 14500 }, { type: 'coins', value: 100000 }, { type: 'parts', value: 20000 }, { type: 'coins', value: 130000 },
  { type: 'parts', value: 16000 }, { type: 'coins', value: 155000 }, { type: 'parts', value: 12000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 15500 },
  { type: 'coins', value: 140000 }, { type: 'parts', value: 18000 }, { type: 'coins', value: 170000 }, { type: 'parts', value: 14000 }, { type: 'coins', value: 105000 },
  { type: 'parts', value: 16500 }, { type: 'coins', value: 160000 }, { type: 'parts', value: 17500 }, { type: 'coins', value: 115000 }, { type: 'parts', value: 13000 },
  { type: 'coins', value: 200000 }, { type: 'parts', value: 21000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 16000 }, { type: 'coins', value: 132000 },
  { type: 'parts', value: 22000 }, { type: 'coins', value: 190000 }, { type: 'parts', value: 15800 }, { type: 'coins', value: 128000 }
];

function casePrizeIcon(type) {
  return type === 'parts' ? '🔧' : '💎';
}

function casePrizeValue(prize) {
  if (!prize) return 0;
  return Number(prize.value ?? prize.finalValue ?? 0) || 0;
}

function casePrizeText(prize) {
  if (!prize) return '—';
  return '+' + formatNumber(casePrizeValue(prize)) + casePrizeIcon(prize.type);
}

function findCasePrizeIndex(prize) {
  if (!prize) return 0;
  const rawIndex = Number(prize.index ?? prize.targetIndex);
  if (Number.isFinite(rawIndex) && rawIndex >= 0) return rawIndex % CASE_PRIZES_UI_FULL.length;

  const baseValue = Number(prize.baseValue || 0);
  if (baseValue > 0) {
    const idx = CASE_PRIZES_UI_FULL.findIndex((p) => p.type === prize.type && Number(p.value) === baseValue);
    if (idx >= 0) return idx;
  }

  const multiplier = Number(prize.multiplier || 1) || 1;
  const final = casePrizeValue(prize);
  if (final > 0) {
    const idx = CASE_PRIZES_UI_FULL.findIndex((p) => p.type === prize.type && Math.floor(Number(p.value) * multiplier) === final);
    if (idx >= 0) return idx;
  }

  return 0;
}

function caseCellHtml(basePrize, multiplier, extraClass = '', forcedValue = null) {
  const finalValue = forcedValue === null ? Math.floor(Number(basePrize.value || 0) * multiplier) : Number(forcedValue || 0);
  return `<div class="case-cell ${extraClass}" data-case-cell="${extraClass ? 'win' : ''}">
    <b>${casePrizeIcon(basePrize.type)}</b>
    <span>${formatNumber(finalValue)}</span>
  </div>`;
}

function showCaseOverlay(prize) {
  const overlay = document.getElementById('caseOverlay');
  if (!overlay) return;

  const multiplier = Number(prize?.multiplier || 1) || 1;
  const winIndex = findCasePrizeIndex(prize);
  const winBase = CASE_PRIZES_UI_FULL[winIndex] || { type: prize?.type || 'coins', value: prize?.baseValue || casePrizeValue(prize) };
  const winValue = casePrizeValue(prize) || Math.floor(Number(winBase.value || 0) * multiplier);

  const items = [];
  // Делаем длинную ленту, но финальная ячейка под указателем = именно выигравший index из сервера.
  for (let i = 0; i < 34; i++) {
    const base = CASE_PRIZES_UI_FULL[(winIndex + 7 + i * 5) % CASE_PRIZES_UI_FULL.length];
    items.push(caseCellHtml(base, multiplier));
  }
  items.push(caseCellHtml(winBase, multiplier, 'case-win', winValue));
  // немного хвоста после победителя, чтобы рулетка выглядела живой
  for (let j = 1; j <= 8; j++) {
    const base = CASE_PRIZES_UI_FULL[(winIndex + j) % CASE_PRIZES_UI_FULL.length];
    items.push(caseCellHtml(base, multiplier));
  }

  overlay.innerHTML = `
    <div class="case-overlay-card case-overlay-card-fixed">
      <h2>🎉 Кейс открыт</h2>
      <div class="case-roulette case-roulette-fixed">
        <div class="case-pointer"></div>
        <div class="case-strip case-strip-fixed">${items.join('')}</div>
      </div>
      <div class="case-result">
        Выигрыш: <b>${casePrizeText({ type: winBase.type, value: winValue })}</b>
        <small>множитель x${multiplier.toFixed(2)} · базовый приз ${formatNumber(winBase.value)}${casePrizeIcon(winBase.type)}</small>
      </div>
      <button id="caseOverlayClose">Закрыть</button>
    </div>
  `;

  overlay.classList.add('active');
  const close = () => overlay.classList.remove('active');
  document.getElementById('caseOverlayClose')?.addEventListener('click', close);

  requestAnimationFrame(() => {
    const roulette = overlay.querySelector('.case-roulette-fixed');
    const strip = overlay.querySelector('.case-strip-fixed');
    const winCell = overlay.querySelector('.case-win');
    if (!roulette || !strip || !winCell) return;

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    requestAnimationFrame(() => {
      const offset = winCell.offsetLeft + (winCell.offsetWidth / 2) - (roulette.clientWidth / 2);
      strip.style.transition = 'transform 2.8s cubic-bezier(.12,.78,.12,1)';
      strip.style.transform = `translateX(-${Math.max(0, offset)}px)`;
    });
  });
}

// openCase тоже переопределяем, чтобы все сообщения брали финальный приз с множителем.
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
  showMessage(`🎰 Кейс: выигрыш ${casePrizeText(data.prize)}. Цена ${formatNumber(data.cost)}💰`);
  await loadMe();
}


/* === HOTFIX: GAMUS mine bonus report + compact +10 building text === */
async function claimGamus() {
  const data = await postJson('/api/farm/gamus/claim');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ GAMUS через ${formatTime(data.remainingMs || 0)} (06:00 МСК)` : `❌ GAMUS: ${data.error}`);
    await loadMe();
    return;
  }

  const money = Number(data.money || 0);
  const parts = Number(data.parts || 0);
  const baseMoney = Number(data.baseMoney || (money - Number(data.mineBonusMoney || 0)));
  const baseParts = Number(data.baseParts || (parts - Number(data.mineBonusParts || 0)));
  const mineBonusMoney = Math.max(0, Number(data.mineBonusMoney || 0));
  const mineBonusParts = Math.max(0, Number(data.mineBonusParts || 0));
  const mineLevel = Number(data.effectiveMineLevel || data.mineLevel || 0);

  renderUnifiedReward('🎁 GAMUS получен', 'Бонус шахты уже включён в итоговую награду', [
    { label: '💎 Итог монет', value: `+${stageFormat(money)}` },
    { label: '🔧 Итог запчастей', value: `+${stageFormat(parts)}` },
    { label: '⛏ Бонус шахты', value: `+${stageFormat(mineBonusMoney)}💎 / +${stageFormat(mineBonusParts)}🔧` },
    { label: '📦 База', value: `${stageFormat(baseMoney)}💎 / ${stageFormat(baseParts)}🔧` },
    { label: '📈 Тир', value: stageFormat(data.tierLevel || 0) },
    { label: '⛏ Шахта', value: mineLevel ? `+${stageFormat(mineLevel)}%` : 'нет бонуса' }
  ]);

  showMessage(`🎁 GAMUS: +${stageFormat(money)}💎 и +${stageFormat(parts)}🔧 | шахта +${stageFormat(mineBonusMoney)}💎 / +${stageFormat(mineBonusParts)}🔧`);
  await loadMe();
}

function buildingPack10Note(afford10) {
  const count = Number(afford10?.count || 0);
  const coins = Number(afford10?.totalCoins || 0);
  const parts = Number(afford10?.totalParts || 0);
  const stop = afford10?.stop ? `<div class="pack10-stop">Стопор: ${afford10.stop}</div>` : '';
  return `<div class="stage-mini-note pack10-note">
    <div><span>Для +10ур доступно</span><b>${stageFormat(count)} ур.</b></div>
    <div><span>Цена 10ур</span><b>${stageFormat(coins)}💰 / ${stageFormat(parts)}🔧</b></div>
    ${stop}
  </div>`;
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
        ${!levelLocked && !maxed ? buildingPack10Note(afford10) : `<div class="stage-mini-note warning">${reason}</div>`}
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}


/* ==========================================================================
   BIG POLISH PATCH: unified modals, case history, market/buildings/info polish,
   admin backup preview UI helpers.
   Appended as safe overrides so older code remains available.
   ========================================================================== */

