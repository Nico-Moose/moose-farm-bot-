
(function () {
  let heartbeatTimer = null;
  let onlineRefreshTimer = null;
  let searchTimer = null;
  let reopenAllFarmersAfterProfile = false;
  let lastAllFarmersQuery = '';
  let lastAllFarmersScroll = 0;
  let hideSelfInOnline = false;
  let currentViewerLogin = '';
  let canToggleHideSelf = false;
  const API = {
    async get(path) {
      const res = await fetch(`/api${path}`, { credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `GET ${path} failed`);
      return data;
    },
    async post(path, body) {
      const res = await fetch(`/api${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `POST ${path} failed`);
      return data;
    }
  };
  function fmtCompact(n) { const num = Number(n || 0); if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}кк`; if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}к`; return String(Math.floor(num)); }
  function byId(id) { return document.getElementById(id); }
  function renderOnline(players) {
    const box = byId('onlineFarmersList'); if (!box) return;
    let list = Array.isArray(players) ? players.slice() : [];
    list.sort((a, b) => Number(b.level || 0) - Number(a.level || 0) || String(a.display_name || a.login || '').localeCompare(String(b.display_name || b.login || ''), 'ru'));
    if (!list.length) { box.innerHTML = '<div class="online-farmers-empty">Сейчас на сайте никого нет.</div>'; return; }
    box.innerHTML = list.map((p) => `<button type="button" class="online-farmer-item" data-farmer-login="${String(p.login || '').toLowerCase()}"><img class="online-farmer-avatar" src="${p.avatar_url || '/favicon.ico'}" alt="${p.display_name || p.login}" /><span class="online-farmer-copy"><span class="online-farmer-name">${p.display_name || p.login}</span><span class="online-farmer-meta">@${p.login} · ур. ${Number(p.level || 0)}</span></span><span class="online-farmer-dot" aria-hidden="true"></span></button>`).join('');
  }
  function renderAllFarmers(players) {
    const box = byId('allFarmersList'); if (!box) return;
    if (!players.length) { box.innerHTML = '<div class="online-farmers-empty">Никого не найдено.</div>'; return; }
    box.innerHTML = players.map((p) => `<button type="button" class="all-farmer-item" data-farmer-login="${String(p.login || '').toLowerCase()}"><img class="online-farmer-avatar" src="${p.avatar_url || '/favicon.ico'}" alt="${p.display_name || p.login}" /><span class="online-farmer-copy"><span class="online-farmer-name">${p.display_name || p.login}</span><span class="online-farmer-meta">@${p.login} · ур. ${Number(p.level || 0)}</span></span><span class="all-farmer-badge ${p.is_online ? 'online' : 'offline'}">${p.is_online ? '🟢 онлайн' : '⚫ оффлайн'}</span></button>`).join('');
  }
  function buildingLabel(key) { const map = { glushilka:'Глушилка','глушилка':'Глушилка',zavod:'Завод','завод':'Завод',kuznica:'Кузница','кузница':'Кузница',ukrepleniya:'Укрепления','укрепления':'Укрепления',fabrika:'Фабрика','фабрика':'Фабрика',shahta:'Шахта','шахта':'Шахта',centr:'Центр рейдов','центр':'Центр рейдов' }; return map[key] || key; }
  function renderFarmerProfile(profile) {
    const box = byId('farmerProfileModalBody'); if (!box) return;
    const buildings = Object.entries(profile.buildings || {});
    box.innerHTML = `<div class="farmer-popup-profile"><div class="farmer-popup-card"><img class="farmer-popup-avatar" src="${profile.avatar_url || '/favicon.ico'}" alt="${profile.display_name || profile.login}" /><h4 class="farmer-popup-name">${profile.display_name || profile.login}</h4><p class="farmer-popup-login">@${profile.login}</p></div><div><div class="farmer-popup-stats"><div class="farmer-popup-stats-grid"><div class="farmer-popup-stat"><span>Уровень</span><b>${Number(profile.level || 0)}</b></div><div class="farmer-popup-stat"><span>Голда</span><b>${fmtCompact(profile.twitch_balance)}</b></div><div class="farmer-popup-stat"><span>Ферма</span><b>${fmtCompact(profile.farm_balance)}</b></div><div class="farmer-popup-stat"><span>Бонусные</span><b>${fmtCompact(profile.upgrade_balance)}</b></div><div class="farmer-popup-stat"><span>Запчасти</span><b>${fmtCompact(profile.parts)}</b></div><div class="farmer-popup-stat"><span>Лицензия</span><b>${Number(profile.license_level || 0)}</b></div><div class="farmer-popup-stat"><span>Рейд-сила</span><b>${Number(profile.raid_power || 0)}</b></div><div class="farmer-popup-stat"><span>Защита</span><b>${Number(profile.protection_level || 0)}</b></div></div></div><div class="farmer-popup-buildings" style="margin-top:14px;"><h4 style="margin:0; font-size:22px;">🏗 Здания</h4><div class="farmer-popup-buildings-grid">${buildings.length ? buildings.map(([key, level]) => `<div class="farmer-building-chip"><strong>${buildingLabel(key)}</strong><small>Ур. ${Number(level || 0)}</small></div>`).join('') : '<div class="online-farmers-empty">Построек пока нет.</div>'}</div></div></div></div>`;
  }
  async function loadOnlineFarmers() { try { const data = await API.get('/farm/online-farmers'); renderOnline(data.players || []); } catch (error) { const box = byId('onlineFarmersList'); if (box) box.innerHTML = `<div class="online-farmers-empty">${error.message}</div>`; } }
  async function loadAllFarmers(query) { const data = await API.get(`/farm/farmers-directory?q=${encodeURIComponent(query || '')}`); renderAllFarmers(data.players || []); }
  async function openFarmerProfile(login, fromDirectory = false) { const modal = byId('farmerProfileModal'); const body = byId('farmerProfileModalBody'); if (!modal || !body) return; if (fromDirectory) { const listDialog = byId('allFarmersModal'); const listBox = byId('allFarmersList'); reopenAllFarmersAfterProfile = true; lastAllFarmersQuery = byId('allFarmersSearch')?.value || ''; lastAllFarmersScroll = listDialog ? listDialog.scrollTop : (listBox ? listBox.scrollTop : 0); closeModal('allFarmersModal'); } else { reopenAllFarmersAfterProfile = false; } modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); body.textContent = 'Загрузка...'; const data = await API.get(`/farm/farmer-profile/${encodeURIComponent(login)}`); renderFarmerProfile(data.profile || {}); }
  function closeModal(id) { const modal = byId(id); if (!modal) return; modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); if (id === 'farmerProfileModal' && reopenAllFarmersAfterProfile) { reopenAllFarmersAfterProfile = false; openAllFarmers(true); } }
  function openAllFarmers(restore = false) { const modal = byId('allFarmersModal'); if (!modal) return; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); const input = byId('allFarmersSearch'); const query = restore ? lastAllFarmersQuery : (input?.value || ''); if (input) input.value = query; loadAllFarmers(query).then(() => { if (restore) { modal.scrollTop = lastAllFarmersScroll || 0; } }).catch((e) => { const box = byId('allFarmersList'); if (box) box.innerHTML = `<div class="online-farmers-empty">${e.message}</div>`; }); if (input) setTimeout(() => input.focus(), 30); }
  async function sendHeartbeat() { try { await API.post('/farm/presence', { page: 'farm' }); } catch (_) {} }
  function startPresenceLoop() { clearInterval(heartbeatTimer); sendHeartbeat(); heartbeatTimer = setInterval(sendHeartbeat, 30000); }
  function startOnlineLoop() { clearInterval(onlineRefreshTimer); loadOnlineFarmers(); onlineRefreshTimer = setInterval(loadOnlineFarmers, 45000); }
  async function syncHideSelfButton() { const hideBtn = byId('toggleHideSelfBtn'); if (!hideBtn) return; if (!canToggleHideSelf) { hideBtn.classList.add('hidden'); return; } hideBtn.classList.remove('hidden'); hideBtn.textContent = hideSelfInOnline ? '🙈 Показать себя' : '🙈 Скрыть себя'; }
  document.addEventListener('click', (event) => { const farmerBtn = event.target.closest('[data-farmer-login]'); if (farmerBtn) { const fromDirectory = !!farmerBtn.closest('#allFarmersList'); openFarmerProfile(farmerBtn.getAttribute('data-farmer-login'), fromDirectory).catch((e) => alert(e.message)); return; } if (event.target.closest('#openAllFarmersBtn')) { openAllFarmers(); return; } if (event.target.closest('#toggleHideSelfBtn')) { if (!canToggleHideSelf) return; hideSelfInOnline = !hideSelfInOnline; API.post('/farm/presence-visibility', { hidden: hideSelfInOnline }).then((data) => { hideSelfInOnline = !!data.hidden; syncHideSelfButton(); loadOnlineFarmers(); }).catch((e) => alert(e.message)); return; } if (event.target.closest('[data-farmer-modal-close]')) { closeModal('farmerProfileModal'); return; } if (event.target.closest('[data-farmers-list-close]')) { closeModal('allFarmersModal'); return; } });
  document.addEventListener('input', (event) => { if (event.target && event.target.id === 'allFarmersSearch') { clearTimeout(searchTimer); const q = event.target.value || ''; lastAllFarmersQuery = q; const modal = byId('allFarmersModal'); if (modal) modal.scrollTop = 0; searchTimer = setTimeout(() => { loadAllFarmers(q).catch((e) => { const box = byId('allFarmersList'); if (box) box.innerHTML = `<div class="online-farmers-empty">${e.message}</div>`; }); }, 180); } });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal('farmerProfileModal'); closeModal('allFarmersModal'); } });
  document.addEventListener('DOMContentLoaded', () => { currentViewerLogin = String(window.__FARM_LOGIN__ || '').toLowerCase(); startPresenceLoop(); startOnlineLoop(); API.get('/farm/presence-visibility').then((data) => { canToggleHideSelf = !!data.can_toggle; hideSelfInOnline = !!data.hidden; syncHideSelfButton(); }).catch(() => {}); const allFarmersModal = byId('allFarmersModal'); if (allFarmersModal) { allFarmersModal.addEventListener('scroll', () => { lastAllFarmersScroll = allFarmersModal.scrollTop; }, { passive: true }); } });
})();
