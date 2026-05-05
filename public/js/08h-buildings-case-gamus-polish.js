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


