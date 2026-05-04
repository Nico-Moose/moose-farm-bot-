/* Split from 08-feature-overrides.js. Logic unchanged. */
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

