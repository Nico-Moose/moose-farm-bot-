/* Safe patch: compact Twitch chat on the main page, lazy-initialized. */
(function () {
  const CHAT_CHANNEL = 'Nico_Moose';
  const MAIN_TAB = 'main';
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

  function tryMountForActiveTab() {
    const activePanel = document.querySelector('.farm-tab-panel.active');
    const activeName = activePanel ? activePanel.getAttribute('data-farm-panel') : MAIN_TAB;
    if (activeName === MAIN_TAB) mountTwitchChat();
  }

  function wrapOpenFarmTab() {
    if (typeof window.openFarmTab !== 'function' || window.openFarmTab.__twitchChatWrapped) return;
    const original = window.openFarmTab;
    const wrapped = function wrappedOpenFarmTab(name) {
      const result = original.apply(this, arguments);
      if ((name || MAIN_TAB) === MAIN_TAB) {
        window.requestAnimationFrame(tryMountForActiveTab);
      }
      return result;
    };
    wrapped.__twitchChatWrapped = true;
    window.openFarmTab = wrapped;
  }

  function initMainTwitchChat() {
    wrapOpenFarmTab();
    tryMountForActiveTab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainTwitchChat, { once: true });
  } else {
    initMainTwitchChat();
  }
})();
