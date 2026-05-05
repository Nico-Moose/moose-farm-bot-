(function () {
  const section = document.getElementById('twitchChatSection');
  if (!section) return;

  const panel = document.querySelector('[data-farm-panel="main"]');
  const frame = document.getElementById('twitchChatFrame');
  const placeholder = document.getElementById('twitchChatPlaceholder');
  const statusEl = document.getElementById('twitchChatStatus');
  const reloadBtn = document.getElementById('twitchChatReload');
  if (!panel || !frame || !placeholder || !statusEl) return;

  const rawChannel = String(section.getAttribute('data-twitch-channel') || 'Nico_Moose').trim();
  const channel = rawChannel.replace(/^@/, '') || 'Nico_Moose';
  const allowedParents = Array.from(new Set([
    window.location.hostname,
    'farm-moose.bothost.tech',
    'localhost'
  ].filter(Boolean)));

  let chatLoaded = false;
  let chatLoading = false;

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function buildChatUrl() {
    const url = new URL(`https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat`);
    allowedParents.forEach((parent) => url.searchParams.append('parent', parent));
    url.searchParams.set('darkpopout', 'true');
    return url.toString();
  }

  function loadChat(force) {
    if (chatLoading) return;
    if (chatLoaded && !force) return;

    chatLoading = true;
    placeholder.classList.remove('hidden');
    setStatus(force ? 'Обновляем Twitch chat…' : 'Подключаем Twitch chat…');

    if (force) {
      frame.removeAttribute('src');
      chatLoaded = false;
    }

    frame.onload = function () {
      chatLoading = false;
      chatLoaded = true;
      placeholder.classList.add('hidden');
      setStatus('Чат подключён');
    };

    frame.onerror = function () {
      chatLoading = false;
      placeholder.classList.remove('hidden');
      setStatus('Не удалось загрузить чат. Попробуй кнопку обновления.');
    };

    frame.src = buildChatUrl();
  }

  function maybeLoadChat() {
    if (!panel.classList.contains('active')) return;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => loadChat(false), { timeout: 1200 });
      return;
    }
    window.setTimeout(() => loadChat(false), 250);
  }

  reloadBtn?.addEventListener('click', function () {
    loadChat(true);
  });

  document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
    btn.addEventListener('click', function () {
      const target = btn.getAttribute('data-farm-tab');
      if (target === 'main') {
        window.setTimeout(maybeLoadChat, 120);
      }
    });
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          maybeLoadChat();
          observer.disconnect();
        }
      });
    }, { rootMargin: '180px 0px' });
    observer.observe(section);
  }

  maybeLoadChat();
})();
