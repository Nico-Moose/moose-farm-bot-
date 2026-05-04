/* Extracted from 10-final-patches.js lines 2616-2911. Safe split, logic unchanged. */
/* === ADMIN JOURNAL SAFE PATCH: 7 days, player filter, hide player card on journal tab === */
(function () {
  const escAdminJournal = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const adminJournalNumber = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.trunc(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  };

  function adminJournalEventName(type) {
    const map = {
      upgrade: '🌾 Ап фермы',
      building_buy: '🏗 Покупка здания',
      building_upgrade: '🏗 Ап здания',
      market_buy_parts: '🏪 Покупка на рынке',
      market_sell_parts: '🏪 Продажа на рынке',
      raid_power_upgrade: '⚔️ Ап рейд-силы',
      protection_upgrade: '🛡️ Ап защиты',
      turret_upgrade: '🔫 Ап турели',
      raid: '🏴 Рейд',
      case_open: '🎰 Кейс',
      gamus_claim: '🎯 GAMUS',
      off_collect: '🌙 Оффсбор',
      collect: '🧺 Сбор',
      license_buy: '📜 Лицензия',
      admin_farm_balance: '👑 Админ: баланс фермы',
      admin_upgrade_balance: '👑 Админ: бонусные',
      admin_parts: '👑 Админ: запчасти',
      admin_set_level: '👑 Админ: уровень',
      admin_set_protection: '👑 Админ: защита',
      admin_set_raid_power: '👑 Админ: рейд-сила',
      admin_transfer_farm: '👑 Админ: перенос фермы',
      admin_clear_debt: '👑 Админ: долги',
      admin_set_market_stock: '👑 Админ: склад рынка',
      admin_reset_cases: '👑 Админ: кейсы',
      admin_reset_gamus: '👑 Админ: GAMUS',
      admin_delete_turret: '👑 Админ: удаление турели',
      admin_restore_backup: '👑 Админ: backup',
      admin_set_roulette_tickets: '👑 Админ: билеты рулетки',
      admin_sync_from_wizebot: '👑 Админ: импорт из WizeBot',
      admin_push_to_wizebot: '👑 Админ: пуш в WizeBot',
      sync_wizebot_harvest: '🔄 WizeBot → сайт'
    };
    return map[type] || type || 'Событие';
  }

  function adminJournalText(event) {
    const p = event?.payload || {};
    const type = event?.type || '';
    const parts = [];

    if (type === 'raid') {
      const money = Number(p.stolen ?? p.money ?? p.farm_delta ?? p.amount ?? 0);
      const bonus = Number(p.bonus_stolen ?? p.bonus ?? p.upgrade_delta ?? 0);
      if (p.target) parts.push('цель: @' + escAdminJournal(p.target));
      if (Number.isFinite(money) && money) parts.push((money > 0 ? '+' : '') + adminJournalNumber(money) + '💰');
      if (Number.isFinite(bonus) && bonus) parts.push((bonus > 0 ? '+' : '') + adminJournalNumber(bonus) + '💎');
      if (p.raid_blocked_by_turret || p.killed_by_turret || p.turret_triggered) parts.push('турель отбила рейд');
      return parts.join(' · ') || 'Рейд записан.';
    }

    if (type === 'off_collect') {
      const money = Number(p.money ?? p.income ?? p.farmIncome ?? 0);
      const bonus = Number(p.bonus ?? p.upgradeIncome ?? 0);
      const details = Number(p.parts ?? p.partsIncome ?? 0);
      if (money) parts.push('получено: ' + adminJournalNumber(money) + '💰');
      if (bonus) parts.push('бонусные: ' + adminJournalNumber(bonus) + '💎');
      if (details) parts.push('запчасти: ' + adminJournalNumber(details) + '🔧');
      return parts.join(' · ') || 'Оффсбор выполнен.';
    }

    if (type === 'market_buy_parts' || type === 'market_sell_parts') {
      if (p.qty !== undefined) parts.push((type === 'market_buy_parts' ? 'куплено: ' : 'продано: ') + adminJournalNumber(p.qty) + '🔧');
      if (p.totalCost !== undefined || p.cost !== undefined) parts.push((type === 'market_buy_parts' ? 'потрачено: ' : 'получено: ') + adminJournalNumber(p.totalCost ?? p.cost) + '💎');
      return parts.join(' · ') || 'Сделка на рынке.';
    }

    if (p.amount !== undefined) parts.push('изменение: ' + adminJournalNumber(p.amount));
    if (p.next !== undefined) parts.push('итог: ' + adminJournalNumber(p.next));
    if (p.qty !== undefined) parts.push('кол-во: ' + adminJournalNumber(p.qty));
    if (p.cost !== undefined) parts.push('цена: ' + adminJournalNumber(p.cost));
    if (p.totalCost !== undefined) parts.push('цена: ' + adminJournalNumber(p.totalCost));
    if (p.money !== undefined) parts.push('монеты: ' + adminJournalNumber(p.money));
    if (p.bonus !== undefined) parts.push('бонусные: ' + adminJournalNumber(p.bonus));
    if (p.parts !== undefined) parts.push('запчасти: ' + adminJournalNumber(p.parts));
    if (p.building) parts.push('здание: ' + escAdminJournal(p.building));
    if (p.oldLogin && p.newLogin) parts.push(escAdminJournal(p.oldLogin) + ' → ' + escAdminJournal(p.newLogin));
    return parts.join(' · ') || 'Действие выполнено.';
  }

  const state = {
    items: [],
    offset: 0,
    total: 0,
    hasMore: false,
    days: 7,
    limit: 100,
    loading: false,
  };

  async function adminJournalGet(path) {
    const res = await fetch('/api/admin/journal/' + path, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Не удалось загрузить админ-журнал');
    return data;
  }

  function setLoadMoreVisible(visible) {
    const btn = document.getElementById('admin-load-more-events');
    if (!btn) return;
    btn.classList.toggle('hidden', !visible);
    btn.disabled = false;
    btn.textContent = 'Показать ещё';
  }

  function appendAdminEvents(events, appendMode) {
    const box = document.getElementById('admin-events-box');
    const summary = document.getElementById('admin-events-summary');
    if (!box) return;
    const list = Array.isArray(events) ? events : [];
    const login = document.getElementById('admin-events-login')?.value?.trim() || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    if (summary) {
      const target = login ? '@' + login.replace(/^@/, '') : 'все игроки';
      const label = type && typeof eventTypeLabel === 'function' ? eventTypeLabel(type) : 'все типы';
      summary.innerHTML = `<b>Показано:</b> ${state.items.length} из ${state.total} · <b>Игрок:</b> ${escAdminJournal(target)} · <b>Тип:</b> ${escAdminJournal(label)} · <b>Период:</b> ${state.days} дней`;
    }
    if (!state.items.length) {
      box.innerHTML = '<div class="admin-events-empty">За последние 7 дней событий не найдено.</div>';
      setLoadMoreVisible(false);
      return;
    }
    const html = list.map((event) => {
      const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
      const loginText = event.login || event.display_name || event.twitch_id || 'unknown';
      const title = typeof eventTypeLabel === 'function' ? eventTypeLabel(event.type) : adminJournalEventName(event.type);
      const tone = String(event.type || '').startsWith('admin_') ? 'admin' : (event.type === 'raid' ? 'raid' : (event.type === 'off_collect' ? 'off' : ((event.type === 'market_buy_parts' || event.type === 'market_sell_parts') ? 'market' : 'default')));
      const icon = event.type === 'raid' ? '🏴' : (event.type === 'off_collect' ? '🌙' : ((event.type === 'market_buy_parts' || event.type === 'market_sell_parts') ? '🏪' : (String(event.type || '').startsWith('admin_') ? '👑' : '📝')));
      return `<div class="admin-event-card admin-event-${tone}">
        <div class="admin-event-head">
          <div><b>${icon} ${escAdminJournal(title)}</b><small>${escAdminJournal(date)}</small></div>
          <span>@${escAdminJournal(loginText)}</span>
        </div>
        <div class="admin-event-body">${escAdminJournal(adminJournalText(event))}</div>
      </div>`;
    }).join('');
    if (appendMode) box.insertAdjacentHTML('beforeend', html);
    else box.innerHTML = html;
    setLoadMoreVisible(state.hasMore);
  }

  window.renderAdminEvents = function renderAdminEventsJournalOnly(events) {
    state.items = Array.isArray(events) ? events.slice() : [];
    appendAdminEvents(state.items, false);
  };

  async function loadAdminEventsPage({ append = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase().replace(/^@/, '') || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    const params = new URLSearchParams({ limit: String(state.limit), days: String(state.days), offset: String(append ? state.offset : 0) });
    if (login) params.set('login', login);
    if (type) params.set('type', type);
    const data = await adminJournalGet('events?' + params.toString());
    state.total = Number(data.total || 0);
    state.hasMore = !!data.hasMore;
    state.offset = Number(data.nextOffset || (append ? state.offset : 0));
    const pageItems = Array.isArray(data.events) ? data.events : [];
    state.items = append ? state.items.concat(pageItems) : pageItems;
    appendAdminEvents(pageItems, append);
    state.loading = false;
  }

  window.loadAdminEvents = async function loadAdminEventsSevenDays() {
    await loadAdminEventsPage({ append: false });
  };

  async function loadAdminPlayers(prefix = '') {
    const data = await adminJournalGet('players?prefix=' + encodeURIComponent(prefix) + '&limit=12');
    return data.players || [];
  }

  function setAdminJournalOnlyMode() {
    const activeTab = document.querySelector('[data-admin-tab].active')?.getAttribute('data-admin-tab');
    const isJournal = activeTab === 'journal';
    const playerInfo = document.getElementById('admin-player-info');
    const playerSearch = document.querySelector('.admin-player-search');
    if (playerInfo) playerInfo.style.display = isJournal ? 'none' : '';
    if (playerSearch) playerSearch.style.display = isJournal ? 'none' : '';
    if (isJournal) {
      const mainLogin = document.getElementById('admin-login')?.value?.trim() || '';
      const journalLogin = document.getElementById('admin-events-login');
      if (journalLogin && !journalLogin.value && mainLogin) journalLogin.value = mainLogin;
      window.loadAdminEvents?.().catch((e) => setAdminStatus?.(e.message, true));
    }
  }

  function setupAdminJournalAutocomplete() {
    const input = document.getElementById('admin-events-login');
    const box = document.getElementById('admin-events-suggestions');
    if (!input || !box || input.dataset.journalAutocompleteReady === '1') return;
    input.dataset.journalAutocompleteReady = '1';
    let timer = null;
    const update = async () => {
      const prefix = input.value.trim().toLowerCase().replace(/^@/, '');
      const players = await loadAdminPlayers(prefix);
      if (!players.length) {
        box.innerHTML = '';
        box.classList.add('hidden');
        return;
      }
      box.innerHTML = players.map((p) => {
        const login = String(p.login || '').toLowerCase();
        const display = p.display_name || p.login || login;
        return `<button type="button" data-admin-journal-suggest="${escAdminJournal(login)}"><b>${escAdminJournal(login)}</b><small>${escAdminJournal(display)} · ур. ${adminJournalNumber(p.level || 0)}</small></button>`;
      }).join('');
      box.classList.remove('hidden');
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => update().catch(() => {}), 120);
    });
    input.addEventListener('focus', () => update().catch(() => {}));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.loadAdminEvents().catch((e) => setAdminStatus(e.message, true));
      }
    });
    box.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-admin-journal-suggest]');
      if (!btn) return;
      input.value = btn.getAttribute('data-admin-journal-suggest');
      box.classList.add('hidden');
      window.loadAdminEvents().catch((e) => setAdminStatus(e.message, true));
    });
    document.addEventListener('click', (event) => {
      if (event.target === input || box.contains(event.target)) return;
      box.classList.add('hidden');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginInput = document.getElementById('admin-events-login');
    if (loginInput) loginInput.placeholder = 'ник игрока или пусто = все игроки за 7 дней';
    const loadBtn = document.getElementById('admin-load-events');
    if (loadBtn) loadBtn.textContent = 'Показать журнал за 7 дней';
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => btn.addEventListener('click', () => setTimeout(setAdminJournalOnlyMode, 0)));
    document.getElementById('admin-events-type')?.addEventListener('change', () => window.loadAdminEvents?.().catch((e) => setAdminStatus?.(e.message, true)));
    document.getElementById('admin-events-login')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.loadAdminEvents?.().catch((err) => setAdminStatus?.(err.message, true));
      }
    });
    document.getElementById('admin-load-more-events')?.addEventListener('click', async () => {
      const btn = document.getElementById('admin-load-more-events');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Загрузка...';
      }
      try {
        await loadAdminEventsPage({ append: true });
      } catch (e) {
        setAdminStatus?.(e.message, true);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Показать ещё';
        }
      }
    });
    setTimeout(setupAdminJournalAutocomplete, 800);
    setTimeout(setAdminJournalOnlyMode, 250);
  });
})();
