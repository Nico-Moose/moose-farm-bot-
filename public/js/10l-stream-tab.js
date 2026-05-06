/* Safe patch: stream tab mounted into existing farm.html containers.
   Online -> Twitch player in #streamVideoEmbed.
   Offline -> custom branded card in #streamVideoEmbed.
   Right-side persistent chat remains the only chat on page. */
(function () {
  const CHANNEL = 'Nico_Moose';
  let lastOnline = null;
  let lastConfirmed = false;
  let pollTimer = null;

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
    const st = data.streamStatus || {};
    return {
      online: !!data.streamOnline,
      confirmed: st.confirmed !== false,
      error: st.error || null
    };
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
      <div class="stream-offline-shell stream-offline-shell-banner">
        <img class="stream-offline-banner" src="/img/stream-offline-banner.png" alt="Стрим скоро начнётся">
      </div>`;
  }


  async function render(force) {
    const panel = document.querySelector('[data-farm-panel="stream"]');
    const videoBox = document.getElementById('streamVideoEmbed');
    if (!panel || !videoBox) return;
    if (!force && !panel.classList.contains('active')) return;


    try {
      const status = await getStreamStatus();
      const online = !!status.online;
      const confirmed = status.confirmed !== false;
      const channel = videoBox.dataset.channel || CHANNEL;

      if (!confirmed) {
        if (videoBox.dataset.loaded === '1') return;
        videoBox.innerHTML = onlineMarkup(channel);
        videoBox.dataset.loaded = '1';
        videoBox.dataset.state = 'fallback-online';
        lastOnline = true;
        lastConfirmed = false;
        return;
      }

      if (!force && lastOnline === online && lastConfirmed === true && videoBox.dataset.loaded === '1') return;
      videoBox.innerHTML = online ? onlineMarkup(channel) : offlineMarkup(channel);
      videoBox.dataset.loaded = '1';
      videoBox.dataset.state = online ? 'online' : 'offline';
      lastOnline = online;
      lastConfirmed = true;
    } catch (_) {
      const channel = videoBox.dataset.channel || CHANNEL;
      if (videoBox.dataset.loaded === '1') return;
      videoBox.innerHTML = onlineMarkup(channel);
      videoBox.dataset.loaded = '1';
      videoBox.dataset.state = 'fallback-online';
      lastOnline = true;
      lastConfirmed = false;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      const panel = document.querySelector('[data-farm-panel="stream"]');
      if (!panel || !panel.classList.contains('active')) return;
      render(true);
    }, 60000);
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
      startPolling();
      if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
    }, { once: true });
  } else {
    hookTabs();
    startPolling();
    if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
  }
})();
