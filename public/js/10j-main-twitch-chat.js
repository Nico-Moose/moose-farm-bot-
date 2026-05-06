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


/* Safe patch: draggable floating Twitch chat with saved position. */
(function () {
  const STORAGE_KEY = 'moose_main_twitch_chat_mode_v1';
  const DEFAULT_MODE = { mode: 'docked', top: 84, right: 16, left: null };
  let drag = null;

  function getCard() {
    return document.querySelector('.main-twitch-chat-card');
  }

  function getModeBtn() {
    return document.getElementById('mainTwitchChatToggleMode');
  }

  function getResetBtn() {
    return document.getElementById('mainTwitchChatResetPos');
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_MODE };
      return {
        mode: parsed.mode === 'floating' ? 'floating' : 'docked',
        top: Number.isFinite(Number(parsed.top)) ? Number(parsed.top) : DEFAULT_MODE.top,
        right: Number.isFinite(Number(parsed.right)) ? Number(parsed.right) : DEFAULT_MODE.right,
        left: parsed.left === null || parsed.left === undefined ? null : (Number.isFinite(Number(parsed.left)) ? Number(parsed.left) : null)
      };
    } catch (_) {
      return { ...DEFAULT_MODE };
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function isMobileViewport() {
    return window.innerWidth <= 980;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function applyState() {
    const card = getCard();
    const modeBtn = getModeBtn();
    const resetBtn = getResetBtn();
    if (!card || !modeBtn || !resetBtn) return;

    const state = readState();
    const shouldFloat = state.mode === 'floating' && !isMobileViewport();
    card.classList.toggle('main-twitch-chat-floating', shouldFloat);

    if (shouldFloat) {
      const width = Math.min(380, Math.max(320, card.offsetWidth || 340));
      const maxLeft = Math.max(8, window.innerWidth - width - 8);
      const top = clamp(state.top, 8, Math.max(8, window.innerHeight - 120));
      let left = state.left;
      if (!Number.isFinite(left)) {
        left = Math.max(8, window.innerWidth - width - (Number(state.right) || 16));
      }
      left = clamp(left, 8, maxLeft);
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.right = 'auto';
      modeBtn.textContent = '🪟 Свободно';
      resetBtn.classList.remove('hidden');
    } else {
      card.style.top = '';
      card.style.left = '';
      card.style.right = '';
      modeBtn.textContent = '✋ Переместить';
      resetBtn.classList.add('hidden');
      if (state.mode !== 'docked') {
        saveState({ ...DEFAULT_MODE });
      }
    }
  }

  function switchMode() {
    const state = readState();
    if (state.mode === 'floating') {
      saveState({ ...DEFAULT_MODE });
    } else {
      const card = getCard();
      const rect = card ? card.getBoundingClientRect() : { top: 84, left: window.innerWidth - 360 };
      saveState({ mode: 'floating', top: Math.round(rect.top), left: Math.round(rect.left), right: null });
    }
    applyState();
  }

  function resetDocked() {
    saveState({ ...DEFAULT_MODE });
    applyState();
  }

  function onPointerDown(event) {
    const card = getCard();
    if (!card || !card.classList.contains('main-twitch-chat-floating')) return;
    const handle = event.target.closest('.main-twitch-chat-drag-handle');
    if (!handle) return;
    if (event.target.closest('a,button')) return;

    const rect = card.getBoundingClientRect();
    drag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    document.body.classList.add('main-twitch-chat-dragging');
    event.preventDefault();
  }

  function onPointerMove(event) {
    const card = getCard();
    if (!card || !drag || !card.classList.contains('main-twitch-chat-floating')) return;
    const width = card.offsetWidth || 340;
    const height = card.offsetHeight || 540;
    const left = clamp(event.clientX - drag.offsetX, 8, Math.max(8, window.innerWidth - width - 8));
    const top = clamp(event.clientY - drag.offsetY, 8, Math.max(8, window.innerHeight - height - 8));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function onPointerUp() {
    const card = getCard();
    if (drag && card && card.classList.contains('main-twitch-chat-floating')) {
      saveState({ mode: 'floating', top: parseInt(card.style.top || '84', 10) || 84, left: parseInt(card.style.left || '16', 10) || 16, right: null });
    }
    drag = null;
    document.body.classList.remove('main-twitch-chat-dragging');
  }

  function initFloatingChat() {
    const card = getCard();
    const modeBtn = getModeBtn();
    const resetBtn = getResetBtn();
    if (!card || !modeBtn || !resetBtn) return;
    modeBtn.addEventListener('click', switchMode);
    resetBtn.addEventListener('click', resetDocked);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', applyState);
    applyState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingChat, { once: true });
  } else {
    initFloatingChat();
  }
})();
