/* Safe patch: dedicated stream tab with smart offline view.
   Online -> Twitch embed player.
   Offline -> custom branded card with links.
   Uses actual Twitch API status for the embed, ignoring manual farm-online overrides. */
(function () {
  const CHANNEL = 'Nico_Moose';
  let loaded = false;
  let lastOnline = null;

  function buildParentList() {
    const parents = new Set(['farm-moose.bothost.tech', 'localhost']);
    const host = (window.location && window.location.hostname ? window.location.hostname : '').trim();
    if (host) parents.add(host);
    if (host === '127.0.0.1') parents.add('localhost');
    return Array.from(parents);
  }

  function buildPlayerUrl(channel) {
    const params = new URLSearchParams();
    buildParentList().forEach((parent) => params.append('parent', parent));
    params.set('channel', channel);
    params.set('muted', 'false');
    params.set('autoplay', 'false');
    return `https://player.twitch.tv/?${params.toString()}`;
  }

  async function getStreamStatus() {
    const res = await fetch('/api/stream/embed-status', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'stream_status_failed');
    return !!data.streamOnline;
  }

  function onlineMarkup(channel) {
    return `
      <section class="stream-tab-card">
        <div class="stream-tab-head">
          <div>
            <h3>▶️ Трансляция</h3>
            <p>Прямой эфир Twitch внутри сайта.</p>
          </div>
          <a class="stream-tab-link" href="https://www.twitch.tv/${channel}" target="_blank" rel="noopener noreferrer">Открыть на Twitch</a>
        </div>
        <div class="stream-player-shell">
          <iframe
            src="${buildPlayerUrl(channel)}"
            title="Twitch stream ${channel}"
            loading="lazy"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
      </section>`;
  }

  function offlineMarkup(channel) {
    return `
      <section class="stream-tab-card">
        <div class="stream-tab-head">
          <div>
            <h3>🎬 Трансляция</h3>
            <p>Стрим сейчас оффлайн — показываем свою заставку вместо стандартного Twitch embed.</p>
          </div>
          <a class="stream-tab-link" href="https://www.twitch.tv/${channel}" target="_blank" rel="noopener noreferrer">Открыть на Twitch</a>
        </div>
        <div class="stream-offline-shell">
          <div class="stream-offline-logo">🫎</div>
          <div class="stream-offline-content">
            <div class="stream-offline-badge">НЕ В СЕТИ</div>
            <div class="stream-offline-sign">
              <span class="stream-offline-title">СТРИМ</span>
              <span class="stream-offline-tag">кастомные режимы</span>
              <span class="stream-offline-subtitle">скоро начнётся</span>
            </div>
            <p class="stream-offline-note">Канал <b>${channel}</b> сейчас оффлайн. Чат справа остаётся доступен, а трансляция автоматически появится здесь, когда стрим станет онлайн.</p>
            <div class="stream-offline-actions">
              <a class="stream-offline-link" href="https://www.twitch.tv/${channel}" target="_blank" rel="noopener noreferrer">▶ Перейти на канал</a>
              <a class="stream-offline-chat-link" href="https://www.twitch.tv/popout/${channel}/chat?popout=" target="_blank" rel="noopener noreferrer">💬 Открыть чат</a>
            </div>
          </div>
        </div>
      </section>`;
  }

  async function render(force) {
    const panel = document.querySelector('[data-farm-panel="stream"]');
    const box = document.getElementById('streamTabBox');
    if (!panel || !box) return;
    if (!force && loaded && !panel.classList.contains('active')) return;

    try {
      const online = await getStreamStatus();
      if (!force && loaded && online === lastOnline) return;
      box.innerHTML = online ? onlineMarkup(CHANNEL) : offlineMarkup(CHANNEL);
      loaded = true;
      lastOnline = online;
    } catch (error) {
      box.innerHTML = offlineMarkup(CHANNEL);
      loaded = true;
      lastOnline = false;
    }
  }

  function hookTabs() {
    document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
      if (btn.dataset.streamBound === '1') return;
      btn.dataset.streamBound = '1';
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-farm-tab');
        if (tab === 'stream') setTimeout(() => render(false), 40);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      hookTabs();
      if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
    }, { once: true });
  } else {
    hookTabs();
    if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
  }
})();
