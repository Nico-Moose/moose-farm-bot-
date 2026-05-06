/* Safe patch: standalone Twitch stream tab. Does not touch farm logic. */
(function () {
  const DEFAULT_CHANNEL = 'Nico_Moose';
  let streamMounted = false;
  let chatMounted = false;

  function parentsQuery() {
    const parents = new Set(['farm-moose.bothost.tech', 'localhost']);
    const host = (window.location && window.location.hostname ? window.location.hostname : '').trim();
    if (host) parents.add(host);
    if (host === '127.0.0.1') parents.add('localhost');
    return Array.from(parents).map((parent) => `parent=${encodeURIComponent(parent)}`).join('&');
  }

  function buildStreamUrl(channel) {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parentsQuery()}&muted=false`;
  }

  function buildChatUrl(channel) {
    return `https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${parentsQuery()}&darkpopout`;
  }

  function mountIframe(box, src, title) {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    box.innerHTML = '';
    box.appendChild(iframe);
    box.dataset.loaded = '1';
  }

  function mountStreamTab() {
    const videoBox = document.getElementById('streamVideoEmbed');
    const chatBox = document.getElementById('streamChatEmbed');

    if (videoBox && !streamMounted) {
      const channel = videoBox.dataset.channel || DEFAULT_CHANNEL;
      mountIframe(videoBox, buildStreamUrl(channel), `Twitch stream ${channel}`);
      streamMounted = true;
    }

    if (chatBox && !chatMounted) {
      const channel = chatBox.dataset.channel || DEFAULT_CHANNEL;
      mountIframe(chatBox, buildChatUrl(channel), `Twitch chat ${channel}`);
      chatMounted = true;
    }
  }

  function isStreamActive() {
    return !!document.querySelector('[data-farm-panel="stream"].active');
  }

  function syncStreamLayoutClass() {
    const active = isStreamActive();
    document.body.classList.toggle('stream-tab-active', active);
    if (active) mountStreamTab();
  }

  function initStreamTab() {
    syncStreamLayoutClass();

    document.querySelectorAll('[data-farm-tab="stream"]').forEach((btn) => {
      if (btn.dataset.streamBound === '1') return;
      btn.dataset.streamBound = '1';
      btn.addEventListener('click', () => setTimeout(syncStreamLayoutClass, 0));
    });

    document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
      if (btn.dataset.streamClassBound === '1') return;
      btn.dataset.streamClassBound = '1';
      btn.addEventListener('click', () => setTimeout(syncStreamLayoutClass, 0));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStreamTab, { once: true });
  } else {
    initStreamTab();
  }
})();
