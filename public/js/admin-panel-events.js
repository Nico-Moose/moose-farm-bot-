

/* ADMIN JOURNAL POLISH + PLAYER AUTOCOMPLETE SAFE PATCH 2026-05-04 */
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fullNum = (v) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.trunc(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  };
  const eventIcon = (type) => {
    if (type === 'raid') return '🏴';
    if (type === 'off_collect') return '🌙';
    if (type === 'market_buy_parts' || type === 'market_sell_parts') return '🏪';
    if (type === 'case_open') return '🎁';
    if (type === 'upgrade' || type === 'building_upgrade') return '⬆️';
    if (type === 'building_buy') return '🏗️';
    if (String(type || '').startsWith('admin_')) return '👑';
    return '📝';
  };
  const eventTone = (type) => {
    if (type === 'raid') return 'raid';
    if (type === 'off_collect') return 'off';
    if (type === 'market_buy_parts' || type === 'market_sell_parts') return 'market';
    if (String(type || '').startsWith('admin_')) return 'admin';
    return 'default';
  };
  const prettyPayload = (payload, type) => {
    payload = payload || {};
    const line = [];
    if (type === 'market_buy_parts') {
      if (payload.qty !== undefined) line.push('куплено: ' + fullNum(payload.qty) + ' 🔧');
      if (payload.totalCost !== undefined) line.push('потрачено: ' + fullNum(payload.totalCost) + ' 💎');
      return line.join(' · ');
    }
    if (type === 'market_sell_parts') {
      if (payload.qty !== undefined) line.push('продано: ' + fullNum(payload.qty) + ' 🔧');
      if (payload.totalCost !== undefined) line.push('получено: ' + fullNum(payload.totalCost) + ' 💎');
      return line.join(' · ');
    }
    if (type === 'off_collect') {
      if (payload.money !== undefined) line.push('получено монет: +' + fullNum(payload.money) + ' 💰');
      if (payload.parts !== undefined || payload.partsIncome !== undefined) line.push('запчасти: +' + fullNum(payload.parts ?? payload.partsIncome) + ' 🔧');
      if (payload.income !== undefined) line.push('доход: ' + fullNum(payload.income));
      return line.join(' · ');
    }
    if (type === 'raid') {
      const money = Number(payload.stolen ?? payload.money ?? 0);
      const bonus = Number(payload.bonus_stolen ?? payload.bonus ?? 0);
      if (payload.target) line.push('цель: @' + payload.target);
      if (money) line.push((money > 0 ? '+' : '') + fullNum(money) + ' 💰');
      if (bonus) line.push((bonus > 0 ? '+' : '') + fullNum(bonus) + ' 💎');
      if (payload.blocked) line.push('блок: ' + fullNum(payload.blocked) + ' 🛡️');
      if (payload.turret_refund) line.push('турель: -' + fullNum(payload.turret_refund) + ' 💰');
      return line.join(' · ') || 'рейд без изменения ресурсов';
    }
    try { return typeof describePayload === 'function' ? describePayload(payload, type) : JSON.stringify(payload).slice(0, 180); }
    catch (_) { return JSON.stringify(payload).slice(0, 180); }
  };

  window.renderAdminEvents = function renderAdminEventsPolished(events) {
    const box = document.getElementById('admin-events-box');
    const summary = document.getElementById('admin-events-summary');
    if (!box) return;
    const list = Array.isArray(events) ? events : [];
    const login = document.getElementById('admin-events-login')?.value?.trim() || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    if (summary) {
      const target = login ? '@' + login.replace(/^@/, '') : 'все игроки';
      const label = type && typeof eventTypeLabel === 'function' ? eventTypeLabel(type) : 'все типы';
      summary.innerHTML = `<b>Показано:</b> ${list.length} · <b>Игрок:</b> ${esc(target)} · <b>Тип:</b> ${esc(label)} · <b>Период:</b> 7 дней`;
    }
    if (!list.length) {
      box.innerHTML = '<div class="admin-events-empty">За последние 7 дней событий не найдено.</div>';
      return;
    }
    box.innerHTML = list.map((event) => {
      const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
      const loginText = event.login || event.display_name || event.twitch_id || 'unknown';
      const title = typeof eventTypeLabel === 'function' ? eventTypeLabel(event.type) : event.type;
      return `<div class="admin-event-card admin-event-${eventTone(event.type)}">
        <div class="admin-event-head">
          <div><b>${eventIcon(event.type)} ${esc(title)}</b><small>${esc(date)}</small></div>
          <span>@${esc(loginText)}</span>
        </div>
        <div class="admin-event-body">${esc(prettyPayload(event.payload, event.type))}</div>
      </div>`;
    }).join('');
  };

  window.loadAdminEvents = async function loadAdminEventsPolished() {
    const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase().replace(/^@/, '') || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    const params = new URLSearchParams({ limit: '300', days: '7' });
    if (login) params.set('login', login);
    if (type) params.set('type', type);
    const data = await adminGet('events?' + params.toString());
    window.renderAdminEvents(data.events || []);
  };

  function setupAdminJournalAutocomplete() {
    const input = document.getElementById('admin-events-login');
    const box = document.getElementById('admin-events-suggestions');
    if (!input || !box || input.dataset.journalAutocompleteReady === '1') return;
    input.dataset.journalAutocompleteReady = '1';
    let timer = null;
    const update = async () => {
      const prefix = input.value.trim().toLowerCase().replace(/^@/, '');
      const players = await fetchAdminPlayers(prefix);
      if (!players.length) {
        box.innerHTML = '';
        box.classList.add('hidden');
        return;
      }
      box.innerHTML = players.map((p) => {
        const login = String(p.login || '').toLowerCase();
        const display = p.display_name || p.login || login;
        return `<button type="button" data-admin-journal-suggest="${esc(login)}"><b>${esc(login)}</b><small>${esc(display)} · ур. ${fullNum(p.level || 0)}</small></button>`;
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

  document.addEventListener('DOMContentLoaded', () => setTimeout(setupAdminJournalAutocomplete, 800));
})();

