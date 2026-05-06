/* Safe patch: stream tab mounted into existing farm.html containers.
   Online -> Twitch player in #streamVideoEmbed.
   Offline -> custom branded card in #streamVideoEmbed.
   Right-side persistent chat remains the only chat on page. */
(function () {
  const CHANNEL = 'Nico_Moose';
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
      if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
    }, { once: true });
  } else {
    hookTabs();
    if (document.querySelector('[data-farm-panel="stream"]')?.classList.contains('active')) render(true);
  }
})();
