function setupAdminPanelShell() {
  const panel = document.getElementById('admin-panel');
  const openBtn = document.getElementById('openAdminPanel');
  const closeBtn = document.getElementById('closeAdminPanel');
  if (!panel || panel.dataset.shellReady === '1') return;
  panel.dataset.shellReady = '1';

  function openPanel() {
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden', 'false');
  }

  function closePanel() {
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
  }

  openBtn?.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) closePanel();
  });

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-admin-tab');
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.toggle('active', b === button));
      document.querySelectorAll('[data-admin-panel]').forEach((box) => {
        box.classList.toggle('active', box.getAttribute('data-admin-panel') === tab);
      });
    });
  });
}

async function fetchAdminPlayers(prefix = '') {
  const data = await adminGet('players?prefix=' + encodeURIComponent(prefix));
  return data.players || [];
}

function setupAdminPlayerAutocomplete() {
  const input = document.getElementById('admin-login');
  const box = document.getElementById('admin-player-suggestions');
  if (!input || !box || input.dataset.autocompleteReady === '1') return;
  input.dataset.autocompleteReady = '1';

  let timer = null;

  async function updateSuggestions() {
    const prefix = input.value.trim().toLowerCase();
    const players = await fetchAdminPlayers(prefix);

    if (!players.length) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }

    box.innerHTML = players.map((p) => {
      const login = String(p.login || '').toLowerCase();
      const display = p.display_name || p.login || login;
      return '<button type="button" data-admin-suggest="' + login + '"><b>' + login + '</b><small>' + display + ' · ур. ' + (p.level || 0) + '</small></button>';
    }).join('');

    box.classList.remove('hidden');
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => updateSuggestions().catch(() => {}), 120);
  });

  input.addEventListener('focus', () => updateSuggestions().catch(() => {}));

  box.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-admin-suggest]');
    if (!btn) return;
    input.value = btn.getAttribute('data-admin-suggest');
    box.classList.add('hidden');
    refreshAdminPlayer().catch((e) => setAdminStatus(e.message, true));
  });

  document.addEventListener('click', (event) => {
    if (event.target === input || box.contains(event.target)) return;
    box.classList.add('hidden');
  });
}

async function initAdminPanelGuard() {
  const panel = document.getElementById("admin-panel");
  const entry = document.getElementById("admin-entry");
  if (!panel) return;

  try {
    const res = await fetch("/api/me");
    const me = await res.json();
    const user = me.user || me.profile || me;

    if (!isAdminUser(user)) {
      panel.remove();
      entry?.remove();
      return;
    }

    entry?.classList.remove("hidden");
    setupAdminPanelShell();
    setupAdminPlayerAutocomplete();
    bindAdminPanel();
    bindExtendedAdminPanel();
    loadAdminChecklist().catch(() => {});
  } catch (_) {
    panel.remove();
    entry?.remove();
  }
}

document.addEventListener("DOMContentLoaded", initAdminPanelGuard);



function renderAdminEvents(events) {
  const box = document.getElementById('admin-events-box');
  if (!box) return;
  box.innerHTML = renderEventsList(events || []);
}

async function loadAdminEvents() {
  const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase() || '';
  const type = document.getElementById('admin-events-type')?.value || '';
  const params = new URLSearchParams({ limit: '120' });
  if (login) params.set('login', login);
  if (type) params.set('type', type);
  const data = await adminGet('events?' + params.toString());
  renderAdminEvents(data.events || []);
}

async function loadAdminChecklist() {
  const data = await adminGet('checklist');
  const box = document.getElementById('admin-status');
  if (!box || !data.checks) return;
  const text = 'Чеклист 1:1: ' + data.checks.map((c) => c.title).join(' / ');
  if (!box.textContent) box.textContent = text;
}

function bindExtendedAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel || panel.dataset.extendedBound === '1') return;
  panel.dataset.extendedBound = '1';

  const loginOrError = () => {
    const login = adminLoginValue();
    if (!login) {
      setAdminStatus('Укажи ник игрока', true);
      return null;
    }
    return login;
  };


  document.getElementById('admin-sync-from-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('import-legacy-farm', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message || `Старая !ферма ${login} перенесена на сайт/farm_v2`);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-push-to-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('push-to-wizebot', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-sync-harvest-from-wizebot')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('sync-harvest-from-wizebot', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-transfer-farm')?.addEventListener('click', async () => {
    try {
      const oldLogin = document.getElementById('admin-transfer-from')?.value?.trim()?.toLowerCase();
      const newLogin = document.getElementById('admin-transfer-to')?.value?.trim()?.toLowerCase();
      if (!oldLogin || !newLogin) return setAdminStatus('Укажи старый и новый ник', true);
      if (!confirm('Перенести ферму ' + oldLogin + ' → ' + newLogin + '?')) return;
      const data = await adminPost('transfer-farm', { oldLogin, newLogin });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-set-market-stock')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const stock = document.getElementById('admin-market-stock')?.value;
      const data = await adminPost('set-market-stock', { login, stock });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-clear-debt')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('clear-debt', { login });
      setAdminStatus(data.message);
      await refreshAdminPlayer();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-clear-all-debts')?.addEventListener('click', async () => {
    try {
      if (!confirm('Списать долги всем игрокам с отрицательным фермерским балансом?')) return;
      const data = await adminPost('clear-debt', {});
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-gamus')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('reset-gamus', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-cases')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('reset-cases', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-reset-cases-all')?.addEventListener('click', async () => {
    try {
      if (!confirm('Сбросить кейсы всем игрокам?')) return;
      const data = await adminPost('reset-cases', {});
      setAdminStatus(data.message);
      await loadMe();
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-load-events')?.addEventListener('click', async () => {
    try {
      await loadAdminEvents();
      setAdminStatus('Админ-журнал загружен');
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-delete-turret')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      if (!confirm('Удалить турель у ' + login + '?')) return;
      const data = await adminPost('delete-turret', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-restore-backup')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      if (!confirm('Восстановить последний backup фермы для ' + login + '?')) return;
      const data = await adminPost('restore-backup', { login });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-set-roulette-tickets')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const amount = document.getElementById('admin-roulette-tickets')?.value;
      const data = await adminPost('set-roulette-tickets', { login, amount });
      renderAdminPlayer(data.profile);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });

  document.getElementById('admin-run-1to1-check')?.addEventListener('click', async () => {
    try {
      const login = loginOrError();
      if (!login) return;
      const data = await adminPost('run-1to1-check', { login });
      const box = document.getElementById('admin-events-box');
      if (box) box.innerHTML = renderAdminCheckReport(data.report);
      setAdminStatus(data.message);
    } catch (e) { setAdminStatus(e.message, true); }
  });
}


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

  window.renderAdminEvents = function renderAdminEventsJournalOnly(events) {
    const box = document.getElementById('admin-events-box');
    if (!box) return;
    const rows = Array.isArray(events) ? events : [];
    if (!rows.length) {
      box.innerHTML = '<p class="admin-journal-empty">За последние 7 дней событий не найдено.</p>';
      return;
    }
    box.innerHTML = '<div class="events-list admin-journal-list">' + rows.map((event) => {
      const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
      const login = event.login || event.display_name || event.payload?.login || '';
      return `<div class="pretty-event-row event-row-clean admin-journal-row">
        <div class="event-title-line"><b>${escAdminJournal(adminJournalEventName(event.type))}</b>${login ? `<span>@${escAdminJournal(login)}</span>` : ''}</div>
        <small>${escAdminJournal(date)}</small>
        <p>${adminJournalText(event)}</p>
      </div>`;
    }).join('') + '</div>';
  };

  window.loadAdminEvents = async function loadAdminEventsSevenDays() {
    const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase().replace(/^@/, '') || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    const params = new URLSearchParams({ limit: '150', days: '7' });
    if (login) params.set('login', login);
    if (type) params.set('type', type);
    const data = await adminGet('events?' + params.toString());
    window.renderAdminEvents(data.events || []);
  };

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
    setTimeout(setAdminJournalOnlyMode, 250);
  });
})();
