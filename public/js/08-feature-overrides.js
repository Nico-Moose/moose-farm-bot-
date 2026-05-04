/* Moose Farm frontend split module: накопленные overrides по рынку/зданиям/топам/кейсам
   Safe-refactor: extracted from public/app.js without logic changes. */
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

function closeUnifiedModal() {
  const modal = document.getElementById('unifiedModal');
  if (modal) modal.remove();
}

function unifiedModal(title, subtitle, body, opts = {}) {
  closeUnifiedModal();
  const overlay = document.createElement('div');
  overlay.id = 'unifiedModal';
  overlay.className = `unified-modal ${opts.kind || 'info'} ${opts.wide ? 'wide' : ''}`;
  overlay.innerHTML = `
    <div class="unified-modal-card">
      <button class="unified-modal-close" type="button">×</button>
      <div class="unified-modal-head">
        <h2>${title || 'Событие'}</h2>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      <div class="unified-modal-body">${body || ''}</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.unified-modal-close')?.addEventListener('click', closeUnifiedModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeUnifiedModal();
  });
  if (opts.autoCloseMs) setTimeout(closeUnifiedModal, opts.autoCloseMs);
  return overlay;
}

function renderUnifiedReward(title, subtitle, rows = [], opts = {}) {
  const body = `<div class="unified-reward-grid">${rows.map((r) => `
    <div class="unified-reward-cell">
      <span>${r.label || ''}</span>
      <b>${r.value || '0'}</b>
      ${r.hint ? `<small>${r.hint}</small>` : ''}
    </div>`).join('')}</div>`;
  return unifiedModal(title, subtitle, body, { kind: opts.kind || 'success', wide: opts.wide, autoCloseMs: opts.autoCloseMs || 9000 });
}

function renderActionReport(title, subtitle, items, opts = {}) {
  const body = `
    <div class="unified-report-list">
      ${items.map((item) => `<div class="unified-report-row"><span>${item.label}</span><b>${item.value}</b></div>`).join('')}
    </div>`;
  return unifiedModal(title, subtitle, body, { kind: opts.kind || 'info', wide: true, autoCloseMs: opts.autoCloseMs || 10000 });
}

function normalizedEventTitle(event) {
  const type = String(event?.type || '').toLowerCase();
  const details = event?.details || event?.payload || {};
  if (type.includes('market')) return '🏪 Рынок';
  if (type.includes('case')) return '🎰 Кейс';
  if (type.includes('raid')) return '🏴‍☠️ Рейд';
  if (type.includes('building')) return '🏗 Здание';
  if (type.includes('license')) return '📜 Лицензия';
  if (type.includes('gamus')) return '🎁 GAMUS';
  if (type.includes('off')) return '🌙 Оффсбор';
  if (type.includes('sync')) return '🔄 Синхронизация';
  return event?.title || '📌 Событие';
}

function formatEventDetails(event) {
  const raw = event?.details || event?.payload || event?.message || '';
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch (_) { obj = raw; }
  }
  if (obj && typeof obj === 'object') {
    const pairs = [];
    const map = {
      login: 'игрок', action: 'действие', amount: 'сумма', qty: 'кол-во',
      totalCost: 'стоимость', level: 'уровень', building: 'здание',
      target: 'цель', attacker: 'атакующий', stolen: 'украдено',
      bonus_stolen: 'бонусные', ok: 'статус'
    };
    Object.keys(obj).slice(0, 8).forEach((k) => {
      if (k === 'keys' || k === 'farm' || k === 'farm_v2' || k === 'payload') return;
      const v = obj[k];
      if (v && typeof v === 'object') return;
      pairs.push(`<span>${map[k] || k}: <b>${String(v)}</b></span>`);
    });
    return pairs.length ? pairs.join(' · ') : 'техническое событие';
  }
  return String(obj || '').replace(/[{}"]/g, '').slice(0, 220);
}

async function loadCaseHistory(login) {
  const p = state?.profile || {};
  const history = (p.farm?.caseHistory || p.caseHistory || []).slice(0, 50);
  const global = (state?.caseHistory || []);
  const rows = (history.length ? history : global).slice(0, 50);
  const body = `
    <div class="case-history-table">
      <div class="case-history-head"><b>#</b><b>Дата</b><b>Тип</b><b>Выигрыш</b><b>Множитель</b><b>Цена</b></div>
      ${rows.length ? rows.map((h, i) => `
        <div class="case-history-row">
          <span>${h.posId || i + 1}</span>
          <span>${h.date || h.timestamp ? new Date(h.date || h.timestamp).toLocaleString('ru-RU') : '—'}</span>
          <span>${h.type === 'parts' ? '🔧 Запчасти' : '💎 Бонусные'}</span>
          <b>${stageFormat(h.finalValue || h.value || 0)}</b>
          <span>x${Number(h.multiplier || h.baseMultiplier || 1).toFixed(2)}</span>
          <span>${stageFormat(h.cost || 0)}💰</span>
        </div>`).join('') : '<div class="case-history-empty">История кейсов пока пустая</div>'}
    </div>`;
  unifiedModal('🎰 История кейсов', `Игрок: ${login || p.login || p.twitch_login || '—'}`, body, { wide: true });
}

function bindGlobalPolishButtons() {
  document.getElementById('showCaseHistoryBtn')?.addEventListener('click', () => loadCaseHistory());
}

async function openCase() {
  const data = await postJson('/api/farm/case/open');
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
      cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
      not_enough_money: `не хватает монет: сейчас ${stageFormat(data.available || 0)} / нужно ${stageFormat(data.needed || 0)}`
    };
    showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showCaseOverlay(data.prize);
  renderUnifiedReward('🎰 Кейс открыт', 'Финальный приз уже с множителем', [
    { label: data.prize?.type === 'parts' ? '🔧 Запчасти' : '💎 Бонусные', value: `+${stageFormat(data.prize?.value || data.prize?.finalValue || 0)}` },
    { label: '✖️ Множитель', value: `x${Number(data.prize?.multiplier || 1).toFixed(2)}` },
    { label: '💰 Цена', value: `${stageFormat(data.cost || 0)}💰` },
    { label: '🎯 Индекс', value: String(data.prize?.targetIndex ?? data.prize?.index ?? '—') }
  ], { wide: true });
  await loadMe();
}

function marketHistoryHtml() {
  return stageMarketHistory.length ? stageMarketHistory.map((h)=>`
    <div class="market-history-row">
      <span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span>
      <b>${h.action === 'buy' ? '🔵 Куплено' : '🟢 Продано'}</b>
      <span>${stageFormat(h.qty)}🔧</span>
      <span>${stageFormat(h.cost)}💎</span>
    </div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>';
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
    <div class="market-hero strict-market-hero">
      <div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>максимум: ${stageFormat(maxBuy)}🔧</small></div>
      <div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>максимум: ${stageFormat(maxSell)}🔧</small></div>
    </div>
    <div class="market-wallet"><span>💎 Баланс: <b>${stageFormat(upgradeBalance)}</b></span><span>🔧 Запчасти: <b>${stageFormat(parts)}</b></span></div>
    <div class="market-preset-row market-preset-row-fixed">
      <button data-market-preset="1000">1к</button>
      <button data-market-preset="10000">10к</button>
      <button data-market-preset="100000">100к</button>
      <button data-market-preset="1000000">1кк</button>
      <button data-market-preset="buyMax">макс купить</button>
      <button data-market-preset="sellMax">макс продать</button>
    </div>
    <div class="market-actions polished-market-actions">
      <input id="marketQty" type="text" inputmode="text" value="${formatHumanInputValue(startQty)}" placeholder="1к / 100к / 1кк / 100кк" />
      <button id="marketBuyBtn" ${maxBuy < 1 ? 'disabled' : ''}>🔵 Купить</button>
      <button id="marketSellBtn" ${maxSell < 1 ? 'disabled' : ''}>🟢 Продать</button>
    </div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history polished-market-history"><div class="section-inline-title">История сделок</div>${marketHistoryHtml()}</div>
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
    const canBuy = q > 0 && q <= maxBuy;
    const canSell = q > 0 && q <= maxSell;
    if (buyBtn) buyBtn.disabled = !canBuy;
    if (sellBtn) sellBtn.disabled = !canSell;
    const calc = document.getElementById('marketCalc');
    if (calc) calc.innerHTML = `
      <div><b>Калькулятор</b>: купить ${stageFormat(q)}🔧 = ${stageFormat(buyCost)}💎 · продать ${stageFormat(q)}🔧 = ${stageFormat(sellGain)}💎</div>
      ${canBuy ? '<span class="okline">✅ Покупка доступна ровно на это количество</span>' : `<span class="warning">⚠️ Купить нельзя. Укажи не больше ${stageFormat(maxBuy)}🔧</span>`}
      ${canSell ? '<span class="okline">✅ Продажа доступна</span>' : `<span class="warning">⚠️ Продать нельзя. Укажи не больше ${stageFormat(maxSell)}🔧</span>`}`;
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
    if (q > maxBuy) return showMessage(`❌ Рынок: максимум покупки сейчас ${stageFormat(maxBuy)}🔧`);
    marketTrade('buy');
  });
  sellBtn?.addEventListener('click', () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    if (q > maxSell) return showMessage(`❌ Рынок: максимум продажи сейчас ${stageFormat(maxSell)}🔧`);
    marketTrade('sell');
  });
}

function buildingCardSummary(key, conf, lvl) {
  return buildingLongBenefit ? buildingLongBenefit(key, conf, lvl) : (conf.description || 'улучшает ферму');
}

function renderInfo(data){
  const infoBox=document.getElementById('infoBox'); const topsBox=document.getElementById('topsBox'); if(!infoBox) return;
  const info=data.farmInfo||{}; const raidInfo=data.raidInfo||{}; const hourly=info.hourly||{}; const balances=info.balances||{}; const buildings=info.buildings||[]; const raidLogs=(raidInfo.logs||[]).slice(0,10);
  const playerCards = [
    ['💰 Обычная голда', balances.twitch || 0, 'WizeBot / !money'],
    ['🌾 Ферма', balances.farm || 0, 'накопления фермы'],
    ['💎 Бонусные', balances.upgrade || 0, 'ап-баланс'],
    ['🔧 Запчасти', balances.parts || 0, 'детали'],
    ['📈 Доход/ч', hourly.total || 0, `пассив ${stageFormat(hourly.passive||0)} · урожай ${stageFormat((hourly.plants||0)+(hourly.animals||0))}`],
    ['🏴 Рейды 14д', raidInfo.twoWeeks?.count || 0, `${stageFormat(raidInfo.twoWeeks?.stolen||0)}💰 · ${stageFormat(raidInfo.twoWeeks?.bonus||0)}💎`],
  ];
  const buildingCells = buildings.length ? buildings.map((b)=>`<div class="info-building-cell"><b>${b.config?.name || b.key}</b><span>ур. ${stageFormat(b.level || 0)}</span><small>${buildingCardSummary(b.key, b.config || {}, b.level || 0)}</small></div>`).join('') : '<div class="info-building-cell"><b>Построек нет</b><span>—</span><small>Построй здания во вкладке зданий.</small></div>';
  infoBox.innerHTML=`
    <div class="analytics-grid">${playerCards.map(([label,value,hint])=>`<div class="analytics-card"><span>${label}</span><b>${stageFormat(value)}</b><small>${hint}</small></div>`).join('')}</div>
    <div class="info-buildings-panel"><h3>🏗 Постройки</h3><div class="info-building-grid">${buildingCells}</div></div>
    <div class="raid-log-list beautiful-raid-log"><div class="section-inline-title">Последние рейды</div>${raidLogs.length?raidLogs.map((r,i)=>`<div class="raid-log-row"><b>${i+1}.</b> ${new Date(r.timestamp||0).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: <b>${stageFormat(r.stolen)}💰</b>, <b>${stageFormat(r.bonus_stolen||0)}💎</b>${r.killed_by_turret?' · 🔫 турель':''}</div>`).join(''):'<div class="raid-log-row">Рейдов пока нет</div>'}</div>
    <button id="refreshTopBtn">🏆 Обновить топы</button>`;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
  if(topsBox && !topsBox.dataset.loaded) loadTops();
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
    const by = (fn) => players.slice().sort((a,b)=>fn(b)-fn(a)).slice(0,5);
    const list = (arr, val, sub) => `<ol>${arr.length ? arr.map((p)=>`<li><span>${p.nick}</span><strong>${val(p)}</strong><em>${sub(p)}</em></li>`).join('') : '<li>нет данных</li>'}</ol>`;
    topsBox.innerHTML = `
      <h3>🏆 Топы и аналитика</h3>
      <div class="tops-grid pretty-tops expanded-tops">
        <div class="top-card"><b>💰 Самые богатые</b>${list(by(p=>ordinaryCoins(p)), p=>`${stageFormat(ordinaryCoins(p))}💰`, p=>`ур. ${p.level} · 🔧${stageFormat(p.parts)}`)}</div>
        <div class="top-card"><b>🌾 Ферма</b>${list(by(p=>farmCoins(p)), p=>`${stageFormat(farmCoins(p))}🌾`, p=>`💎${stageFormat(bonusCoins(p))}`)}</div>
        <div class="top-card"><b>💎 Ап-баланс</b>${list(by(p=>bonusCoins(p)), p=>`${stageFormat(bonusCoins(p))}💎`, p=>`💰${stageFormat(ordinaryCoins(p))}`)}</div>
        <div class="top-card"><b>🔧 Запчасти</b>${list(by(p=>Number(p.parts||0)), p=>`${stageFormat(p.parts)}🔧`, p=>`ур. ${p.level}`)}</div>
        <div class="top-card"><b>🏴 Топ рейдов за ${data.days}д</b><ol>${raids.length ? raids.map((r) => `<li><span>${r.nick}</span><strong>${stageFormat(r.money)}💰 / ${stageFormat(r.bonus)}💎</strong><em>${r.attacks}⚔ · ${r.defends}🛡</em></li>`).join('') : '<li>нет рейдов</li>'}</ol></div>
        <div class="top-card"><b>⚡ Активные</b>${list(by(p=>Number(p.last_collect_at||0)), p=>p.nick, p=>p.last_collect_at ? new Date(Number(p.last_collect_at)).toLocaleString('ru-RU') : 'нет сбора')}</div>
      </div>`;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}
