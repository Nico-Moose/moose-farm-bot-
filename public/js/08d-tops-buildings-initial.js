/* Split from 08-feature-overrides.js. Logic unchanged. */
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

