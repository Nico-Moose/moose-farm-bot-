/* Split from 08-feature-overrides.js. Logic unchanged. */
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
