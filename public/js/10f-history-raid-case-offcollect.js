/* Extracted from 10-final-patches.js lines 1224-1670. Safe split, logic unchanged. */
/* ==========================================================================
   PATCH: single factual history rows + hide technical sync rows
   ========================================================================== */
(function(){
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, (ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function fmt(value){ if (typeof stageFormat === 'function') return stageFormat(value); if (typeof formatNumber === 'function') return formatNumber(value); return String(value ?? 0); }
  function getPayload(e){ let p=e?.payload||e?.details||{}; if(typeof p==='string'){ try{p=JSON.parse(p);}catch(_){}} return p && typeof p==='object' ? p : {}; }
  function isTechSync(e){ const t=String(e?.type||'').toLowerCase(); return t.startsWith('sync_') || t.includes('sync_wizebot'); }
  function titleFor(e,p){ const t=String(e?.type||'').toLowerCase(); const s=String(p.source||p.action||'').toLowerCase();
    if(p.building||t.includes('building')) return '🏗 Здание улучшено';
    if(t.includes('raid_power')||s.includes('raid_power')) return '🏴 Рейд-сила улучшена';
    if(t.includes('turret')||s.includes('turret')) return '🔫 Турель улучшена';
    if(t.includes('protection')||s.includes('protection')||t.includes('defense')||s.includes('defense')) return '🛡 Защита улучшена';
    if(t==='upgrade'||s.includes('farm_upgrade')) return '🌾 Ферма улучшена';
    if(t.includes('case')) return '🎰 Кейс открыт';
    if(t.includes('market')) return '🏪 Рынок';
    if(t.includes('raid')) return '🏴 Рейд';
    if(t.includes('off')) return '🌙 Оффсбор';
    if(t.includes('gamus')) return '🎁 GAMUS';
    return '📌 Событие'; }
  function textFor(e,p){ const t=String(e?.type||'').toLowerCase(); const s=String(p.source||p.action||'').toLowerCase(); const money=p.totalCost??p.cost??p.coins??0; const parts=p.totalParts??p.parts??0; const up=p.upgraded??p.levels??p.count??1; const lvl=p.level??p.newLevel;
    if(p.building||t.includes('building')) return `Игрок улучшил здание: <b>${esc(p.building||p.key||'здание')}</b> +${fmt(up)} ур.${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('raid_power')||s.includes('raid_power')) return `Игрок улучшил рейд-силу${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('turret')||s.includes('turret')) return `Игрок улучшил турель${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('protection')||s.includes('protection')||t.includes('defense')||s.includes('defense')) return `Игрок улучшил защиту${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t==='upgrade'||s.includes('farm_upgrade')) return `Игрок улучшил ферму +${fmt(up)} ур.${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('case')){ const val=p.prizeValue??p.finalValue??p.value??0; const icon=(p.prizeType||p.type)==='parts'?'🔧':'💎'; return `Игрок открыл кейс${val?` и получил <b>+${fmt(val)}${icon}</b>`:''}.`; }
    if(t.includes('market')) return `Операция на рынке${p.qty?`: ${fmt(p.qty)}🔧`:''}${money?` за ${fmt(money)}💎`:''}.`;
    return 'Действие выполнено.'; }
  renderEventsList = function renderEventsList(events){ const rows=(events||[]).filter((e)=>!isTechSync(e)); if(!rows.length) return '<p>Событий пока нет.</p>'; return rows.map((e)=>{ const p=getPayload(e); const login=e.login||p.login||state?.profile?.login||''; const date=e.created_at||e.timestamp||e.date||Date.now(); return `<div class="pretty-event-row event-row-clean history-human-row"><div class="event-title-line"><b>${titleFor(e,p)}</b>${login?`<span>@${esc(login)}</span>`:''}</div><small>${new Date(date).toLocaleString('ru-RU')}</small><p>${textFor(e,p)}</p></div>`; }).join(''); };
})();

/* ==========================================================================
   PATCH: restore readable raid modal/history + long case roulette only
   ========================================================================== */
(function(){
  function rrEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function rrFmt(value) {
    if (typeof stageFormat === 'function') return stageFormat(value);
    if (typeof formatNumber === 'function') return formatNumber(value);
    return String(value ?? 0);
  }
  function rrIsTurret(log = {}) {
    return !!(log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered);
  }
  function rrCoinDelta(log = {}) {
    if (rrIsTurret(log)) {
      const penalty = Number(log.turret_refund || log.turret_penalty || log.penalty || log.stolen || 0);
      return -Math.abs(penalty);
    }
    return Number(log.stolen || 0);
  }
  function rrBonusDelta(log = {}) {
    if (rrIsTurret(log)) return 0;
    return Number(log.bonus_stolen || 0) + Number(log.turret_bonus || 0);
  }
  function rrSigned(value, icon) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}${rrFmt(Math.abs(n))}${icon}`;
  }
  function rrTitle(log = {}) {
    if (rrIsTurret(log)) return '🔫 Рейд отбит турелью';
    const me = String(state?.profile?.login || state?.user?.login || '').toLowerCase();
    const attacker = String(log.attacker || '').toLowerCase();
    return attacker === me ? '🏴‍☠️ Твой рейд' : '🛡 Рейд на тебя';
  }
  function rrMini(log = {}) {
    const parts = [rrSigned(rrCoinDelta(log), '💰')];
    const bonus = rrBonusDelta(log);
    if (bonus) parts.push(rrSigned(bonus, '💎'));
    if (rrIsTurret(log)) parts.push('🔫 турель');
    return parts.join(' · ');
  }
  function rrExtraRows(log = {}) {
    const rows = [];
    const base = Number(log.base_income || 0);
    const blocked = Number(log.blocked || 0);
    const afk = Number(log.punish_mult || 1);
    const turretChance = Number(log.turret_chance || log.turretChance || 0);
    const turretPenalty = Number(log.turret_refund || 0);
    const mainSpent = Number(log.money_from_main || log.main_spent || log.from_main || 0);
    const farmSpent = Number(log.money_from_farm || log.farm_spent || log.from_farm || 0);
    const debt = Number(log.debt_after || log.farm_debt || 0);
    const jammerLevel = Number(log.jammer_level || log.jammerLevel || 0);

    if (base) rows.push(['Базовый доход цели', `${rrFmt(base)}💰`]);
    if (blocked) rows.push(['Щит / защита заблокировали', `${rrFmt(blocked)}💰`]);
    rows.push(['AFK-множитель', `x${afk.toFixed(2)}`]);
    if (turretChance) rows.push(['Шанс турели', `${rrFmt(turretChance)}%`]);
    if (rrIsTurret(log)) rows.push(['Турель списала', `${rrFmt(turretPenalty || Math.abs(rrCoinDelta(log)))}💰`]);
    if (jammerLevel) rows.push(['Глушилка цели', `-${rrFmt(jammerLevel * 5)}% к шансу турели`]);
    if (mainSpent) rows.push(['Снято с обычной голды', `${rrFmt(mainSpent)}💰`]);
    if (farmSpent) rows.push(['Снято с фермы', `${rrFmt(farmSpent)}🌾`]);
    if (debt < 0) rows.push(['Долг после рейда', `${rrFmt(debt)}🌾`]);
    return rows;
  }
  function rrBody(log = {}, opts = {}) {
    const target = rrEscape(log.target || 'неизвестно');
    const attacker = rrEscape(log.attacker || 'игрок');
    const date = log.timestamp || log.date ? new Date(log.timestamp || log.date).toLocaleString('ru-RU') : '—';
    const cards = [
      ['🎯 Цель', target, ''],
      ['⚔️ Сила рейда', `${rrFmt(log.strength || 0)}%`, ''],
      ['💰 Итог монет', rrSigned(rrCoinDelta(log), '💰'), rrCoinDelta(log) >= 0 ? 'good' : 'bad'],
      ['💎 Бонусные', rrSigned(rrBonusDelta(log), '💎'), rrBonusDelta(log) > 0 ? 'good' : '']
    ];
    const rows = rrExtraRows(log);
    return `
      <div class="raid-primary-grid polished-raid-grid">
        ${cards.map(([label, value, mark]) => `<div class="raid-primary-card ${mark}"><span>${label}</span><b>${value}</b></div>`).join('')}
      </div>
      <div class="raid-secondary-grid polished-raid-meta">
        <div><span>🕒 Дата</span><b>${date}</b></div>
        <div><span>⚔️ Атакующий</span><b>${attacker}</b></div>
        <div><span>🎯 Цель</span><b>${target}</b></div>
        <div><span>📌 Итог</span><b>${rrIsTurret(log) ? 'рейд отбит турелью' : 'рейд успешен'}</b></div>
      </div>
      ${rows.length ? `
      <details class="raid-details-more polished-raid-details" ${opts.openDetails ? 'open' : ''}>
        <summary>Подробнее</summary>
        <div class="raid-rows-clean polished-raid-rows">
          ${rows.map(([label, value]) => `<div><span>${rrEscape(label)}</span><b>${value}</b></div>`).join('')}
        </div>
      </details>` : ''}
    `;
  }

  openRaidLogModal = function openRaidLogModal(index = 0) {
    const logs = latestRaidLogsFromState();
    const log = logs[index];
    if (!log) {
      showMessage('📜 История рейдов пока пустая.');
      return;
    }
    const list = logs.slice(0, 12).map((r, i) => `
      <button class="raid-history-mini ${i === index ? 'active' : ''}" data-raid-log-index="${i}" type="button">
        <b>${i + 1}. ${rrEscape(r.attacker || '—')} → ${rrEscape(r.target || '—')}</b>
        <span>${rrMini(r)}</span>
      </button>`).join('');
    const body = `
      <div class="raid-history-modal-layout">
        <div class="raid-history-sidebar">${list}</div>
        <div class="raid-history-detail">${rrBody(log, { openDetails: true })}</div>
      </div>`;
    unifiedModal(rrTitle(log), `${rrEscape(log.attacker || '—')} → ${rrEscape(log.target || '—')}`, body, { wide: true, kind: rrIsTurret(log) ? 'danger' : 'raid' });
    document.querySelectorAll('[data-raid-log-index]').forEach((btn) => {
      btn.addEventListener('click', () => openRaidLogModal(Number(btn.dataset.raidLogIndex || 0)));
    });
  };

  showRaidDetails = function showRaidDetails(log = {}) {
    unifiedModal(rrTitle(log), `${rrEscape(log.attacker || 'игрок')} → ${rrEscape(log.target || 'цель')}`, rrBody(log, { openDetails: true }), {
      kind: rrIsTurret(log) ? 'danger' : 'raid',
      wide: false
    });
  };

  doRaid = async function doRaid() {
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
    showRaidDetails(log);
    if (rrIsTurret(log)) {
      showMessage(`🔫 Турель ${log.target || 'цели'} отбила рейд. Списано ${rrFmt(Math.abs(rrCoinDelta(log)))}💰`);
    } else {
      showMessage(`🏴‍☠️ Рейд на ${log.target || 'цель'}: ${rrSigned(rrCoinDelta(log), '💰')}${rrBonusDelta(log) ? ' и ' + rrSigned(rrBonusDelta(log), '💎') : ''}`);
    }
    await loadMe();
    if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
  };

  const CASE_ROULETTE_DURATION = 12000;
  let caseSpinTimer = null;
  showCaseOverlay = function showCaseOverlay(prize) {
    const overlay = document.getElementById('caseOverlay');
    if (!overlay) return;

    const multiplier = Number(prize?.multiplier || 1) || 1;
    const winIndex = findCasePrizeIndex(prize);
    const winBase = CASE_PRIZES_UI_FULL[winIndex] || { type: prize?.type || 'coins', value: prize?.baseValue || casePrizeValue(prize) };
    const winValue = casePrizeValue(prize) || Math.floor(Number(winBase.value || 0) * multiplier);
    const items = [];
    const winnerPos = 38;
    const totalItems = 54;

    for (let i = 0; i < totalItems; i++) {
      const base = i === winnerPos ? winBase : CASE_PRIZES_UI_FULL[(winIndex + 3 + i * 5) % CASE_PRIZES_UI_FULL.length];
      const extra = i === winnerPos ? 'case-pending-win' : '';
      items.push(caseCellHtml(base, multiplier, extra, i === winnerPos ? winValue : null));
    }

    overlay.innerHTML = `
      <div class="case-overlay-card case-overlay-card-fixed case-overlay-card-longspin">
        <h2>🎰 Кейс открывается</h2>
        <div class="case-roulette case-roulette-fixed">
          <div class="case-pointer"></div>
          <div class="case-strip case-strip-fixed">${items.join('')}</div>
        </div>
        <div class="case-result case-result-pending">
          <div class="case-result-status">Рулетка крутится…</div>
          <small>Финальный приз появится после остановки рулетки</small>
        </div>
        <button id="caseOverlayClose">Закрыть</button>
      </div>`;

    overlay.classList.add('active');
    document.getElementById('caseOverlayClose')?.addEventListener('click', () => overlay.classList.remove('active'));

    const reveal = () => {
      const resultBox = overlay.querySelector('.case-result');
      const winCell = overlay.querySelector('.case-pending-win');
      if (resultBox) {
        resultBox.classList.remove('case-result-pending');
        resultBox.innerHTML = `Выигрыш: <b>${casePrizeText({ type: winBase.type, value: winValue })}</b><small>множитель x${multiplier.toFixed(2)} · базовый приз ${rrFmt(winBase.value)}${casePrizeIcon(winBase.type)}</small>`;
      }
      winCell?.classList.add('case-win');
    };

    requestAnimationFrame(() => {
      const roulette = overlay.querySelector('.case-roulette-fixed');
      const strip = overlay.querySelector('.case-strip-fixed');
      const winCell = overlay.querySelector('.case-pending-win');
      if (!roulette || !strip || !winCell) return;
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0px)';
      requestAnimationFrame(() => {
        const offset = winCell.offsetLeft + (winCell.offsetWidth / 2) - (roulette.clientWidth / 2);
        strip.style.transition = `transform ${CASE_ROULETTE_DURATION}ms cubic-bezier(.06,.82,.12,1)`;
        strip.style.transform = `translateX(-${Math.max(0, offset)}px)`;
        if (caseSpinTimer) clearTimeout(caseSpinTimer);
        caseSpinTimer = setTimeout(reveal, CASE_ROULETTE_DURATION + 100);
      });
    });
  };

  openCase = async function openCase() {
    const data = await postJson('/api/farm/case/open');
    if (!data.ok) {
      const labels = {
        farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
        cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
        not_enough_money: `не хватает монет: сейчас ${rrFmt(data.available || 0)} / нужно ${rrFmt(data.needed || 0)}`
      };
      showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
      await loadMe(true);
      return;
    }
    showCaseOverlay(data.prize);
    showMessage('🎰 Кейс открыт. Рулетка крутится...');
    await loadMe(true);
  };
})();

/* ==========================================================================
   PATCH: offcollect + clickable raid list + market history limit/toast only
   ========================================================================== */
(function(){
  function pNum(v){ return Number(v || 0); }
  function pFmt(v){ return typeof stageFormat === 'function' ? stageFormat(v) : (typeof formatNumber === 'function' ? formatNumber(v) : String(v || 0)); }
  function pEsc(v){ return String(v ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function pSigned(v, icon){ const n = Number(v || 0); return `${n > 0 ? '+' : n < 0 ? '-' : ''}${pFmt(Math.abs(n))}${icon}`; }
  function pTurret(log = {}){ return !!(log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered); }
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
    box.innerHTML = `
      <div class="combat-card polished-extra-card">
        <h3>🎰 Кейс</h3>
        <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
        <p>Цена: <b>${pFmt(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
        <p>Призы: <b>${pFmt(ranges.minMoney || cs.minMoney || 0)}-${pFmt(ranges.maxMoney || cs.maxMoney || 0)}💎</b> / <b>${pFmt(ranges.minParts || cs.minParts || 0)}-${pFmt(ranges.maxParts || cs.maxParts || 0)}🔧</b></p>
        <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
        <div class="extra-actions"><button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button><button id="showCaseHistoryBtn" class="ghost-action">📜 Последние кейсы</button></div>
      </div>
      <div class="combat-card">
        <h3>🧠 GAMUS</h3>
        <p>Тир: <b>${pFmt(ranges.tierLevel || 0)}</b> | шахта: <b>${pFmt(ranges.mineLevel || 0)}</b></p>
        <p>Награда: <b>${pFmt(ranges.minMoney || 0)}-${pFmt(ranges.maxMoney || 0)}💎</b> / <b>${pFmt(ranges.minParts || 0)}-${pFmt(ranges.maxParts || 0)}🔧</b></p>
        <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
        <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
      </div>
      <div class="combat-card">
        <h3>🌙 Оффсбор</h3>
        <p>50% от общего дохода в час. Запчасти даёт только завод / 2.</p>
        <p>Баланс сейчас: <b>${pFmt(p.farm_balance || 0)}🌾</b> / <b>${pFmt(p.parts || 0)}🔧</b></p>
        <button id="offCollectBtn">🌙 Оффсбор</button>
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

  offCollect = async function offCollect() {
    if (state?.streamOnline || state?.profile?.stream_online) {
      showMessage('⛔ Во время стрима оффсбор недоступен.');
      return;
    }
    const data = await postJson('/api/farm/off-collect');
    if (!data.ok) {
      showMessage(data.error === 'cooldown' ? `⏳ Оффсбор через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
      await loadMe();
      return;
    }
    showActionToast('🌙 Оффсбор получен', [
      `Монеты: <b>+${pFmt(data.income || 0)}💰</b>`,
      `Запчасти: <b>+${pFmt(data.partsIncome || 0)}🔧</b>`,
      data.minutes ? `Период: <b>${pFmt(data.minutes)} мин</b>` : ''
    ].filter(Boolean), { kind: 'success' });
    await loadMe();
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

