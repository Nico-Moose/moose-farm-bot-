/* ==========================================================================
   PATCH: offcollect + clickable raid list + market history limit/toast only
   ========================================================================== */
(function(){
  function pNum(v){ return Number(v || 0); }
  function pFmt(v){ return typeof stageFormat === 'function' ? stageFormat(v) : (typeof formatNumber === 'function' ? formatNumber(v) : String(v || 0)); }
  function pEsc(v){ return String(v ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function pSigned(v, icon){ const n = Number(v || 0); return `${n > 0 ? '+' : n < 0 ? '-' : ''}${pFmt(Math.abs(n))}${icon}`; }
  function pTurret(log = {}){ return !!(log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered); }
  function streamIsOnline(data = state){ return !!(data?.streamOnline || data?.profile?.stream_online); }
  function streamErrorLabel(error){
    if (error === 'stream_offline') return 'доступно только когда стрим онлайн';
    if (error === 'stream_online') return 'доступно только когда стрим оффлайн';
    return error;
  }
  function pRaidMoney(log = {}) {
    if (pTurret(log)) {
      const penalty = pNum(log.turret_refund || log.turret_penalty || log.penalty || log.stolen || 0);
      return -Math.abs(penalty);
    }
    return pNum(log.stolen || 0);
  }
  function pRaidBonus(log = {}) {
    if (pTurret(log)) return 0;
    return pNum(log.bonus_stolen || 0) + pNum(log.turret_bonus || 0);
  }

  // market history only 15 rows
  pushMarketHistory = function pushMarketHistory(item){
    stageMarketHistory.unshift({ ...item, ts: Date.now() });
    stageMarketHistory = stageMarketHistory.slice(0, 15);
    localStorage.setItem('stageMarketHistory', JSON.stringify(stageMarketHistory));
  };

  // Only toast for market buy/sell, no second popup
  marketTrade = async function marketTrade(action) {
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
        quantity_too_large: `слишком большое число, максимум ${pFmt(data.maxQty || 0)}🔧`,
        not_enough_parts: `не хватает запчастей: ${pFmt(data.available || 0)}/${pFmt(data.needed || 0)}🔧`,
        not_enough_upgrade_balance: `не хватает 💎: ${pFmt(data.available || 0)} / ${pFmt(data.needed || 0)}`,
        market_stock_empty: 'общий склад пуст',
        not_enough_market_stock: 'на общем складе недостаточно 🔧'
      };
      showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
      await loadMe();
      return;
    }
    pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 });
    showActionToast(
      action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке',
      [
        action === 'buy' ? `Куплено: <b>${pFmt(data.qty)}🔧</b>` : `Продано: <b>${pFmt(data.qty)}🔧</b>`,
        action === 'buy' ? `Потрачено: <b>${pFmt(data.totalCost)}💎</b>` : `Получено: <b>${pFmt(data.totalCost)}💎</b>`,
        `Общий склад: <b>${pFmt(data.market?.stock ?? 0)}🔧</b>`
      ],
      { kind: 'market' }
    );
    await loadMe();
  };

  function buildingCoinsSummary(conf = {}, lvl = 0) {
    const coinPerLevel = pNum(conf.coinsPerHour || 0) + pNum(conf.coinsPerLevel || 0);
    return coinPerLevel > 0 ? coinPerLevel * pNum(lvl) : 0;
  }

  buildingCardSummary = function buildingCardSummary(key, conf, lvl) {
    key = String(key || '').toLowerCase();
    if (key === 'завод') {
      const parts = pNum(conf?.baseProduction || 0) + pNum(conf?.perLevel || 0) * Math.max(0, pNum(lvl) - 1);
      const coins = buildingCoinsSummary(conf, lvl);
      return `производит запчасти: ${pFmt(parts)}🔧/ч${coins ? ` · монеты: +${pFmt(coins)}/ч` : ''}`;
    }
    if (key === 'фабрика') {
      const boost = pNum(conf?.baseProduction || 0) + pNum(conf?.perLevel || 0) * Math.max(0, pNum(lvl) - 1);
      const coins = buildingCoinsSummary(conf, lvl);
      return `усиливает производство запчастей на ${pFmt(boost)}%${coins ? ` · монеты: +${pFmt(coins)}/ч` : ''}`;
    }
    return (typeof buildingLongBenefit === 'function' ? buildingLongBenefit(key, conf, lvl) : (conf?.description || 'улучшает ферму'));
  };

  renderExtras = function renderExtras(data) {
    const box = document.getElementById('extrasBox');
    if (!box) return;
    const p = data.profile || {};
    const cs = data.caseStatus || {};
    const gamus = data.gamus || {};
    const ranges = gamus.ranges || {};
    const streamOnline = streamIsOnline(data);
    box.classList.add('main-actions-extras-grid');
    box.innerHTML = `
      <div class="combat-card compact-extra-card polished-extra-card">
        <div class="compact-extra-title">🎰 Кейс</div>
        <div class="compact-extra-lines">
          <p>Доступ: <b>${streamOnline ? (cs.unlocked ? 'можно открыть' : 'с 30 ур.') : 'только при стриме'}</b></p>
          <p>Цена: <b>${pFmt(cs.cost || 0)}💰</b> | x<b>${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
          <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
        </div>
        <div class="compact-extra-actions">
          <button id="openCaseBtn" ${!streamOnline || !cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button>
          <button id="showCaseHistoryBtn" class="ghost-action">📜 Последние кейсы</button>
        </div>
      </div>
      <div class="combat-card compact-extra-card">
        <div class="compact-extra-title">🧠 GAMUS</div>
        <div class="compact-extra-lines">
          <p>Тир: <b>${pFmt(ranges.tierLevel || 0)}</b> | шахта: <b>${pFmt(ranges.mineLevel || 0)}</b></p>
          <p>Награда: <b>${pFmt(ranges.minMoney || 0)}-${pFmt(ranges.maxMoney || 0)}💎</b> / <b>${pFmt(ranges.minParts || 0)}-${pFmt(ranges.maxParts || 0)}🔧</b></p>
          <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
        </div>
        <div class="compact-extra-actions">
          <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
        </div>
      </div>
      <div class="combat-card compact-extra-card">
        <div class="compact-extra-title">🌙 Оффсбор</div>
        <div class="compact-extra-lines">
          <p>50% от дохода в час. Завод даёт <b>/2</b>.</p>
          <p>Баланс: <b>${pFmt(p.farm_balance || 0)}🌾</b> / <b>${pFmt(p.parts || 0)}🔧</b></p>
          <p><b>${streamOnline ? 'доступен только оффлайн' : 'доступен сейчас'}</b></p>
        </div>
        <div class="compact-extra-actions">
          <button id="offCollectBtn" ${streamOnline ? 'disabled' : ''}>🌙 Оффсбор</button>
        </div>
      </div>
    `;
    document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
    document.getElementById('showCaseHistoryBtn')?.addEventListener('click', () => {
      if (typeof loadCaseHistory === 'function') return loadCaseHistory();
      if (typeof showCaseHistoryModal === 'function') return showCaseHistoryModal(cs.history || []);
    });
    document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
    document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
  };

  renderInfo = function renderInfo(data){
    const infoBox=document.getElementById('infoBox');
    const topsBox=document.getElementById('topsBox');
    if(!infoBox) return;
    const info=data.farmInfo||{};
    const raidInfo=data.raidInfo||{};
    const hourly=info.hourly||{};
    const balances=info.balances||{};
    const buildings=info.buildings||[];
    const raidLogs=(raidInfo.logs||[]).slice(0,10);
    const playerCards = [
      ['💰 Обычная голда', balances.twitch || 0, 'WizeBot / !money'],
      ['🌾 Ферма', balances.farm || 0, 'накопления фермы'],
      ['💎 Бонусные', balances.upgrade || 0, 'ап-баланс'],
      ['🔧 Запчасти', balances.parts || 0, 'детали'],
      ['📈 Доход/ч', hourly.total || 0, `пассив ${pFmt(hourly.passive||0)} · урожай ${pFmt((hourly.plants||0)+(hourly.animals||0))}`],
      ['🏴 Рейды 14д', raidInfo.twoWeeks?.count || 0, `${pFmt(raidInfo.twoWeeks?.stolen||0)}💰 · ${pFmt(raidInfo.twoWeeks?.bonus||0)}💎`],
    ];
    const buildingCells = buildings.length ? buildings.map((b)=>`<div class="info-building-cell"><b>${pEsc(b.config?.name || b.key)}</b><span>ур. ${pFmt(b.level || 0)}</span><small>${buildingCardSummary(b.key, b.config || {}, b.level || 0)}</small></div>`).join('') : '<div class="info-building-cell"><b>Построек нет</b><span>—</span><small>Построй здания во вкладке зданий.</small></div>';
    const raidRows = raidLogs.length ? raidLogs.map((r,i)=>`
      <button class="raid-log-row polished-raid-log-row" type="button" data-raid-log-index="${i}">
        <div class="raid-log-main">
          <b>${i+1}. ${new Date(r.timestamp||r.date||0).toLocaleString('ru-RU')} — ${pEsc(r.attacker || '—')} → ${pEsc(r.target || '—')}</b>
        </div>
        <div class="raid-log-meta">
          <span>${pSigned(pRaidMoney(r), '💰')}</span>
          <span>${pSigned(pRaidBonus(r), '💎')}</span>
          <span>${pTurret(r) ? '🔫 турель' : `${pFmt(r.strength || 0)}%`}</span>
        </div>
      </button>`).join('') : '<div class="raid-log-row">Рейдов пока нет</div>';
    infoBox.innerHTML=`
      <div class="analytics-grid">${playerCards.map(([label,value,hint])=>`<div class="analytics-card"><span>${label}</span><b>${pFmt(value)}</b><small>${hint}</small></div>`).join('')}</div>
      <div class="info-buildings-panel"><h3>🏗 Постройки</h3><div class="info-building-grid">${buildingCells}</div></div>
      <div class="raid-log-list beautiful-raid-log polished-raid-log-list"><div class="section-inline-title">Последние рейды</div>${raidRows}</div>
      <button id="refreshTopBtn">🏆 Обновить топы</button>`;
    document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
    document.querySelectorAll('[data-raid-log-index]').forEach((btn)=>btn.addEventListener('click', ()=>openRaidLogModal(Number(btn.dataset.raidLogIndex||0))));
    if(topsBox && !topsBox.dataset.loaded) loadTops();
  };
})();

