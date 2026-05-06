/* Safe patch: stream tab mounted into existing farm.html containers.
   Online -> Twitch player in #streamVideoEmbed.
   Offline -> custom branded card in #streamVideoEmbed.
   Chat is always mounted into #streamChatEmbed. */
(function () {
  const CHANNEL = 'Nico_Moose';
  let lastOnline = null;
  let chatMounted = false;

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

  function buildChatUrl(channel) {
    const params = new URLSearchParams();
    buildParentList().forEach((parent) => params.append('parent', parent));
    return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${params.toString()}&darkpopout`;
  }

  async function getStreamStatus() {
    const res = await fetch('/api/stream/embed-status', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || 'stream_status_failed');
    return !!data.streamOnline;
  }

  function onlineMarkup(channel) {
    return `
      <div class="stream-player-shell">
        <iframe
          src="${buildPlayerUrl(channel)}"
          title="Twitch stream ${channel}"
          loading="lazy"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
  }

  function offlineMarkup(channel) {
    return `
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
      </div>`;
  }

  function mountChat(force) {
    const box = document.getElementById('streamChatEmbed');
    if (!box) return;
    if (chatMounted && !force && box.dataset.loaded === '1') return;
    const channel = box.dataset.channel || CHANNEL;
    box.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = buildChatUrl(channel);
    iframe.title = `Twitch chat ${channel}`;
    iframe.loading = 'lazy';
    iframe.allowFullscreen = false;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    box.appendChild(iframe);
    box.dataset.loaded = '1';
    chatMounted = true;
  }

  async function render(force) {
    const panel = document.querySelector('[data-farm-panel="stream"]');
    const videoBox = document.getElementById('streamVideoEmbed');
    if (!panel || !videoBox) return;
    if (!force && !panel.classList.contains('active')) return;

    mountChat(force);

    try {
      const online = await getStreamStatus();
      if (!force && lastOnline === online && videoBox.dataset.loaded === '1') return;
      const channel = videoBox.dataset.channel || CHANNEL;
      videoBox.innerHTML = online ? onlineMarkup(channel) : offlineMarkup(channel);
      videoBox.dataset.loaded = '1';
      lastOnline = online;
    } catch (_) {
      const channel = videoBox.dataset.channel || CHANNEL;
      videoBox.innerHTML = offlineMarkup(channel);
      videoBox.dataset.loaded = '1';
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
      mountChat(true);
      if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
    }, { once: true });
  } else {
    hookTabs();
    mountChat(true);
    if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
  }
})();
