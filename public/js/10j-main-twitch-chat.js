/* Safe patch: persistent Twitch chat for every farm tab.
   The iframe is mounted once and stays outside tab panels, so tab switching never removes it. */
(function () {
  const CHAT_CHANNEL = 'Nico_Moose';
  let chatInitialized = false;

  function buildParentList() {
    const parents = new Set(['farm-moose.bothost.tech', 'localhost']);
    const host = (window.location && window.location.hostname ? window.location.hostname : '').trim();
    if (host) parents.add(host);
    if (host === '127.0.0.1') parents.add('localhost');
    return Array.from(parents);
  }

  function buildChatUrl(channel) {
    const parents = buildParentList();
    const query = parents.map((parent) => `parent=${encodeURIComponent(parent)}`).join('&');
    return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${query}&darkpopout`;
  }

  function mountTwitchChat() {
    if (chatInitialized) return;
    const mount = document.getElementById('mainTwitchChatEmbed');
    if (!mount) return;

    const channel = mount.dataset.channel || CHAT_CHANNEL;
    const iframe = document.createElement('iframe');
    iframe.src = buildChatUrl(channel);
    iframe.title = `Twitch chat ${channel}`;
    iframe.loading = 'eager';
    iframe.allowFullscreen = false;
    iframe.allow = 'clipboard-read; clipboard-write; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('data-twitch-chat-safe', '1');

    mount.innerHTML = '';
    mount.appendChild(iframe);
    mount.dataset.loaded = '1';
    chatInitialized = true;
  }


  function updateFixedChatTop() {
    const card = document.querySelector('.main-twitch-chat-card');
    const layout = document.querySelector('.main-dashboard-layout');
    if (!card || !layout) return;

    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 1450px)').matches;
    if (!isDesktop) {
      document.documentElement.style.removeProperty('--main-twitch-fixed-top');
      return;
    }

    const minTop = 84;
    const normalTop = Math.round(layout.getBoundingClientRect().top);
    const top = Math.max(minTop, normalTop);
    document.documentElement.style.setProperty('--main-twitch-fixed-top', `${top}px`);
  }

  let rafId = 0;
  function scheduleFixedChatTopUpdate() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      updateFixedChatTop();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountTwitchChat();
      updateFixedChatTop();
    }, { once: true });
  } else {
    mountTwitchChat();
    updateFixedChatTop();
  }

  window.addEventListener('scroll', scheduleFixedChatTopUpdate, { passive: true });
  window.addEventListener('resize', scheduleFixedChatTopUpdate, { passive: true });
})();
