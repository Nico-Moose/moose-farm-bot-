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
    iframe.loading = 'lazy';
    iframe.allowFullscreen = false;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    mount.innerHTML = '';
    mount.appendChild(iframe);
    mount.dataset.loaded = '1';
    chatInitialized = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountTwitchChat, { once: true });
  } else {
    mountTwitchChat();
  }
})();
