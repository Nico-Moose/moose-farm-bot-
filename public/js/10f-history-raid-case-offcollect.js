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
   PATCH: user history pagination + 7-day filter + grouped by day
   ========================================================================== */
(function(){
  const HISTORY_PAGE_SIZE = 10;
  const historyState = window.__farmHistoryState = window.__farmHistoryState || {
    events: [],
    page: 1,
    totalPages: 1,
    type: '',
    days: 7
  };

  function hsEsc(value){ return String(value ?? '').replace(/[&<>"']/g, (ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function hsFmt(value){ if (typeof stageFormat === 'function') return stageFormat(value || 0); if (typeof formatNumber === 'function') return formatNumber(value || 0); return String(value ?? 0); }
  function hsPayload(e){ let p=e?.payload||{}; if(typeof p==='string'){ try{ p=JSON.parse(p);}catch(_){ p={}; } } return p&&typeof p==='object'?p:{}; }
  function hsDayKey(ts){ return new Date(Number(ts || Date.now())).toLocaleDateString('ru-RU'); }
  function hsDateTime(ts){ return new Date(Number(ts || Date.now())).toLocaleString('ru-RU'); }

  function hsTitle(event){
    const p = hsPayload(event);
    const t = String(event?.type || '').toLowerCase();
    if (t === 'upgrade') return '🌾 Ферма улучшена';
    if (t === 'building_buy') return '🏗 Здание куплено';
    if (t === 'building_upgrade') return '🏗 Здание улучшено';
    if (t === 'market_buy_parts') return '🏪 Куплены запчасти';
    if (t === 'market_sell_parts') return '🏪 Проданы запчасти';
    if (t === 'raid') return p.killed_by_turret ? '🔫 Рейд отбит турелью' : '🏴 Рейд выполнен';
    if (t === 'case_open') return '🎰 Кейс открыт';
    if (t === 'gamus_claim') return '🎁 GAMUS получен';
    if (t === 'off_collect') return '🌙 Оффсбор получен';
    return '📌 Событие';
  }

  function hsText(event){
    const p = hsPayload(event);
    const t = String(event?.type || '').toLowerCase();
    if (t === 'upgrade') {
      const levels = Number(p.levels || p.upgraded || 1) || 1;
      const newLevel = Number(p.level || p.newLevel || 0) || 0;
      return `Ферма улучшена на ${hsFmt(levels)} ур.${newLevel ? ` Теперь уровень ${hsFmt(newLevel)}.` : ''}${p.totalCost ? ` Потрачено ${hsFmt(p.totalCost)}💰.` : ''}${p.totalParts ? ` Потрачено ${hsFmt(p.totalParts)}🔧.` : ''}`;
    }
    if (t === 'building_buy' || t === 'building_upgrade') {
      const building = p.buildingName || p.building || p.key || 'здание';
      const level = Number(p.level || p.newLevel || 0) || 0;
      return `${t === 'building_buy' ? 'Куплено' : 'Улучшено'} здание «${hsEsc(building)}»${level ? ` до ур. ${hsFmt(level)}.` : '.'}${p.cost ? ` Потрачено ${hsFmt(p.cost)}💰.` : ''}${p.parts ? ` Потрачено ${hsFmt(p.parts)}🔧.` : ''}`;
    }
    if (t === 'market_buy_parts') return `Куплено ${hsFmt(p.qty || p.parts || 0)}🔧${p.cost ? ` за ${hsFmt(p.cost)}💎.` : '.'}`;
    if (t === 'market_sell_parts') return `Продано ${hsFmt(p.qty || p.parts || 0)}🔧${p.gain || p.reward ? ` за ${hsFmt(p.gain || p.reward)}💎.` : '.'}`;
    if (t === 'raid') return p.killed_by_turret ? `Рейд на ${hsEsc(p.target || 'цель')} был отбит турелью.` : `Рейд на ${hsEsc(p.target || 'цель')} принёс ${hsFmt(p.stolen || 0)}💰${p.bonus_stolen ? ` и ${hsFmt(p.bonus_stolen)}💎.` : '.'}`;
    if (t === 'case_open') return `Открыт кейс${p.prizeValue ? `, получено ${hsFmt(p.prizeValue)}${p.prizeType === 'parts' ? '🔧' : '💎'}.` : '.'}`;
    if (t === 'gamus_claim') return `Получен GAMUS${p.tier ? ` тира ${hsFmt(p.tier)}.` : '.'}`;
    if (t === 'off_collect') return `Получен оффсбор${p.income ? `: ${hsFmt(p.income)}💰.` : '.'}${p.partsIncome ? ` Запчасти: ${hsFmt(p.partsIncome)}🔧.` : ''}`;

    const details = [];
    if (p.eventTitle) details.push(p.eventTitle);
    if (p.login) details.push(`игрок: ${p.login}`);
    if (p.level) details.push(`уровень: ${hsFmt(p.level)}`);
    if (p.cost) details.push(`цена: ${hsFmt(p.cost)}💰`);
    if (p.parts) details.push(`запчасти: ${hsFmt(p.parts)}🔧`);
    if (p.amount) details.push(`значение: ${hsFmt(p.amount)}`);
    return details.length ? details.join(' · ') : 'Действие выполнено.';
  }

  function hsRenderPager(){
    const pager = document.getElementById('historyPager');
    if (!pager) return;
    if (!historyState.events.length) { pager.innerHTML = ''; return; }
    const totalPages = historyState.totalPages || 1;
    const page = historyState.page || 1;
    const buttons = [];
    buttons.push(`<button type="button" data-history-page="prev" ${page <= 1 ? 'disabled' : ''}>← Назад</button>`);
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
        buttons.push(`<button type="button" data-history-page="${i}" class="${i === page ? 'active' : ''}">${i}</button>`);
      } else if (Math.abs(i - page) === 2) {
        buttons.push('<span class="history-pager-dots">…</span>');
      }
    }
    buttons.push(`<button type="button" data-history-page="next" ${page >= totalPages ? 'disabled' : ''}>Вперёд →</button>`);
    pager.innerHTML = `<div class="history-pager-inner">${buttons.join('')}</div>`;
  }

  function hsRenderList(events){
    const rows = Array.isArray(events) ? events : [];
    if (!rows.length) return '<div class="history-empty-state">За выбранный период событий не найдено.</div>';
    let html = '';
    let currentDay = '';
    rows.forEach((event) => {
      const day = hsDayKey(event.created_at);
      if (day !== currentDay) {
        currentDay = day;
        html += `<div class="history-day-separator">${hsEsc(day)}</div>`;
      }
      const login = event.login || event.display_name || state?.profile?.login || '';
      html += `<div class="pretty-event-row event-row-clean history-human-row history-card-row">
        <div class="event-title-line"><b>${hsTitle(event)}</b>${login ? `<span>@${hsEsc(login)}</span>` : ''}</div>
        <small>${hsDateTime(event.created_at)}</small>
        <p>${hsText(event)}</p>
      </div>`;
    });
    return `<div class="events-list history-paged-list">${html}</div>`;
  }

  function hsRenderCurrentPage(){
    const box = document.getElementById('historyBox');
    if (!box) return;
    const all = historyState.events || [];
    historyState.totalPages = Math.max(1, Math.ceil(all.length / HISTORY_PAGE_SIZE));
    if (historyState.page > historyState.totalPages) historyState.page = historyState.totalPages;
    if (historyState.page < 1) historyState.page = 1;
    const start = (historyState.page - 1) * HISTORY_PAGE_SIZE;
    const rows = all.slice(start, start + HISTORY_PAGE_SIZE);
    box.innerHTML = hsRenderList(rows);
    hsRenderPager();
  }

  window.loadHistory = async function loadHistoryPatched(){
    const box = document.getElementById('historyBox');
    if (!box) return;
    const type = document.getElementById('historyType')?.value || '';
    const days = Math.min(7, Math.max(1, parseInt(document.getElementById('historyDays')?.value || '7', 10) || 7));
    box.innerHTML = '<div class="history-empty-state">Загрузка истории...</div>';
    const url = '/api/farm/history?limit=70&days=' + encodeURIComponent(days) + (type ? '&type=' + encodeURIComponent(type) : '');
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'history_failed');
    historyState.events = Array.isArray(data.events) ? data.events : [];
    historyState.page = 1;
    historyState.type = type;
    historyState.days = days;
    hsRenderCurrentPage();
  };

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-history-page]');
    if (!btn) return;
    const value = btn.getAttribute('data-history-page');
    if (value === 'prev') historyState.page -= 1;
    else if (value === 'next') historyState.page += 1;
    else historyState.page = parseInt(value, 10) || 1;
    hsRenderCurrentPage();
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('historyDays')?.addEventListener('change', () => {
      window.loadHistory?.().catch((e) => showMessage('❌ История: ' + e.message));
    });
  });
})();
