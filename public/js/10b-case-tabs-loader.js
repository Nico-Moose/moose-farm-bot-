/* Extracted from 10-final-patches.js lines 176-280. Safe split, logic unchanged. */
/* ==========================================================================
   PATCH: single case modal + bottom-right scroll button + lighter tab loading
   ========================================================================== */
(function(){
  let meCache = null;
  let meCacheTs = 0;
  let mePromise = null;

  async function fetchMeCached(force) {
    const now = Date.now();
    if (!force && meCache && (now - meCacheTs) < 1200) return meCache;
    if (!force && mePromise) return mePromise;
    mePromise = fetch('/api/me')
      .then(async (res) => {
        if (res.status === 401) {
          location.href = '/';
          return null;
        }
        const data = await res.json();
        meCache = data;
        meCacheTs = Date.now();
        return data;
      })
      .finally(() => { mePromise = null; });
    return mePromise;
  }

  // Полегче первичная загрузка: history грузим только на вкладке журнала.
  loadMe = async function loadMe(force) {
    try {
      const data = await fetchMeCached(!!force);
      if (!data) return;
      render(data);
      const activePanel = document.querySelector('.farm-tab-panel.active')?.getAttribute('data-farm-panel') || 'main';
      if (activePanel === 'tops' || activePanel === 'info') {
        refreshTopsIfVisible(true).catch((err) => console.warn('[TOPS]', err));
      }
    } catch (error) {
      document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
      console.error(error);
    }
  };

  openFarmTab = function openFarmTab(name) {
    const target = name || 'main';
    document.querySelectorAll('.farm-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.getAttribute('data-farm-panel') === target);
    });
    document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-farm-tab') === target && btn.classList.contains('farm-tab'));
    });

    if (target === 'tops' || target === 'info') {
      refreshTopsIfVisible(true).catch((err) => console.warn('[TOPS]', err));
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  installScrollTopButton = function installScrollTopButton() {
    if (document.getElementById('scrollTopBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.type = 'button';
    btn.title = 'Наверх';
    btn.setAttribute('aria-label', 'Наверх');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    const update = () => {
      btn.classList.toggle('visible', window.scrollY > 500);
    };

    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  // Один кейс-модал: только рулетка, без второго отдельного окна результата.
  openCase = async function openCase() {
    const data = await postJson('/api/farm/case/open');
    if (!data.ok) {
      const labels = {
        farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
        cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
        not_enough_money: `не хватает монет: сейчас ${stageFormat(data.available || 0)} / нужно ${stageFormat(data.needed || 0)}`
      };
      showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
      await loadMe(true);
      return;
    }

    showCaseOverlay(data.prize);
    showMessage(`🎰 Кейс: выигрыш ${prizeLabel(data.prize)}. Цена ${stageFormat(data.cost || 0)}💰`);
    await loadMe(true);
  };

  // Переинициализация после загрузки патча
  document.addEventListener('DOMContentLoaded', () => {
    installScrollTopButton();
  });
})();

