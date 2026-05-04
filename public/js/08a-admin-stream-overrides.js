/* Split from 08-feature-overrides.js. Logic unchanged. */
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
