/* Extracted from 10-final-patches.js lines 604-917. Safe split, logic unchanged. */
/* ==========================================================================
   PATCH: ultra-fast site actions + optimistic state refresh + stale guard
   ========================================================================== */
(function(){
  function buildExpectedUpdatedAt(url, body) {
    if (!String(url || '').startsWith('/api/farm/')) return body;
    if (!state?.profile?.updated_at) return body;
    if (body && Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) return body;
    return { ...(body || {}), expectedUpdatedAt: Number(state.profile.updated_at || 0) };
  }

  function hasRenderablePayload(data) {
    return !!(data && data.profile && data.farmInfo && data.market && data.raidUpgrades && data.turret);
  }

  function applyServerState(data) {
    if (!hasRenderablePayload(data)) return false;
    state = data;
    render(data);
    return true;
  }

  const oldPostJsonFast = postJson;
  postJson = async function postJson(url, body = {}) {
    const nextBody = buildExpectedUpdatedAt(url, body);
    return oldPostJsonFast(url, nextBody);
  };

  async function refreshIfNeeded(data, force) {
    if (!applyServerState(data) || force) {
      await loadMe(true);
    }
  }

  async function handleFastAction(data, options = {}) {
    const stale = data?.error === 'stale_profile';
    const inProgress = data?.error === 'action_in_progress' || data?.httpStatus === 409;
    if (stale || inProgress) {
      showMessage(`⏳ ${data.message || 'Профиль уже изменился. Обновляем данные...'}`);
      await loadMe(true);
      return true;
    }
    if (!data?.ok) {
      showMessage(options.failMessage || `❌ Ошибка: ${data?.error || 'unknown_error'}`);
      await refreshIfNeeded(data, true);
      return true;
    }
    applyServerState(data);
    return false;
  }

  const oldUpgradeBuilding = upgradeBuilding;
  upgradeBuilding = async function upgradeBuilding(key, count) {
    const data = await postJson('/api/farm/building/upgrade', { key, count });
    if (await handleFastAction(data, { failMessage: `❌ Не удалось улучшить ${key}: ${data?.stopReason || data?.error || 'ошибка'}` })) return;
    showMessage(`🏗 ${data.name || key}: +${formatNumber(data.upgraded || 0)} ур. Потрачено ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
  };

  const oldBuyBuilding = buyBuilding;
  buyBuilding = async function buyBuilding(key) {
    const data = await postJson('/api/farm/building/buy', { key });
    if (await handleFastAction(data, { failMessage: `❌ Не удалось купить ${key}: ${data?.error || 'ошибка'}` })) return;
    showMessage(`🏗 Куплено: ${data.name || key}. Потрачено ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
  };

  upgradeRaidPower = async function upgradeRaidPower(count) {
    const data = await postJson('/api/farm/raid-power/upgrade', { count });
    if (await handleFastAction(data, { failMessage: `❌ Рейд-сила не улучшена: ${data?.error || 'ошибка'}` })) return;
    showMessage(`⚔️ Рейд-сила +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost || 0)}💎`);
  };

  upgradeProtection = async function upgradeProtection(count) {
    const data = await postJson('/api/farm/protection/upgrade', { count });
    if (await handleFastAction(data, { failMessage: `❌ Защита не улучшена: ${data?.error || 'ошибка'}` })) return;
    showMessage(`🛡 Защита +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost || 0)}💎`);
  };

  upgradeTurret = async function upgradeTurret() {
    const data = await postJson('/api/farm/turret/upgrade');
    if (await handleFastAction(data, { failMessage: `❌ Турель не улучшена: ${data?.error || 'ошибка'}` })) return;
    showMessage(`🔫 Турель улучшена до ${data.level} ур. Потрачено ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
  };

  const oldLoadMeFast = loadMe;
  loadMe = async function loadMe(force) {
    await oldLoadMeFast(force);
    if (state?.profile) {
      document.querySelectorAll('[data-building-upgrade],[data-building-buy],[data-raid-power],[data-protection],#turretUpgradeBtn').forEach((btn) => {
        if (!btn) return;
        btn.dataset.profileRevision = String(state.profile.updated_at || '0');
      });
    }
  };
})();


/* ==========================================================================
   HOTFIX: false stale_profile from async sync + instant farm upgrade retry
   ========================================================================== */
(function(){
  const fastUpgradeLocks = new Set();

  function canApplyPayload(data) {
    return !!(data && data.profile && data.farmInfo && data.market && data.raidUpgrades && data.turret);
  }

  function applyPayloadSilently(data) {
    if (!canApplyPayload(data)) return false;
    state = data;
    render(data);
    return true;
  }

  async function postFarmUpgradeWithSoftRetry(count) {
    let data = await postJson('/api/farm/upgrade', { count });

    // Если получили stale_profile, сначала тихо применяем свежий state из ответа,
    // затем один раз автоматически повторяем тот же ап с новым expectedUpdatedAt.
    if (data?.error === 'stale_profile') {
      applyPayloadSilently(data);
      data = await postJson('/api/farm/upgrade', { count });
    }

    return data;
  }

  async function runFastFarmUpgrade(btn, count) {
    const key = 'farm-upgrade:' + count;
    if (fastUpgradeLocks.has(key)) {
      showMessage('⏳ Улучшение уже выполняется. Подожди ответ сервера.');
      return;
    }

    fastUpgradeLocks.add(key);
    const oldHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-busy');
      btn.innerHTML = '⏳ Выполняется...';
    }

    try {
      const data = await postFarmUpgradeWithSoftRetry(count);

      if (data?.error === 'action_in_progress' || (data?.httpStatus === 409 && data?.error !== 'stale_profile')) {
        applyPayloadSilently(data);
        showMessage('⏳ Действие уже выполняется. Данные обновлены.');
        return;
      }

      if (!data?.ok) {
        const applied = applyPayloadSilently(data);
        showMessage(farmUpgradeErrorMessage(data));
        if (!applied) await loadMe(true);
        return;
      }

      if (!applyPayloadSilently(data)) {
        await loadMe(true);
      }

      showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost || 0)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
    } finally {
      fastUpgradeLocks.delete(key);
      if (btn) {
        btn.classList.remove('is-busy');
        btn.disabled = false;
        btn.innerHTML = oldHtml;
      }
    }
  }

  function rebindFarmUpgradeButton(id, count) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.fastFarmUpgradeBound === '1') return;
    const clone = btn.cloneNode(true);
    clone.dataset.fastFarmUpgradeBound = '1';
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', () => runFastFarmUpgrade(clone, count));
  }

  const oldRenderForFastUpgrade = typeof render === 'function' ? render : null;
  if (oldRenderForFastUpgrade && !window.__mooseFastFarmUpgradePatch) {
    window.__mooseFastFarmUpgradePatch = true;
    render = function patchedRenderForFastUpgrade(data) {
      oldRenderForFastUpgrade(data);
      rebindFarmUpgradeButton('upgrade1Btn', 1);
      rebindFarmUpgradeButton('upgrade10Btn', 10);
    };
  }

  setTimeout(function() {
    rebindFarmUpgradeButton('upgrade1Btn', 1);
    rebindFarmUpgradeButton('upgrade10Btn', 10);
  }, 0);
})();


/* ==========================================================================
   HOTFIX: live no-cache refresh for online UI + instant profile repaint
   ========================================================================== */
(function(){
  function bust(url) {
    const sep = String(url).includes('?') ? '&' : '?';
    return `${url}${sep}_=${Date.now()}`;
  }

  async function fetchJsonNoStore(url, options = {}) {
    const res = await fetch(bust(url), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(options.headers || {})
      },
      ...options
    });
    return res;
  }

  const oldLoadMeNoStore = loadMe;
  loadMe = async function loadMe(force) {
    try {
      const res = await fetchJsonNoStore('/api/me');
      if (res.status === 401) {
        location.href = '/';
        return;
      }
      const data = await res.json();
      render(data);
      return data;
    } catch (error) {
      document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
      console.error(error);
    }
  };

  function renderFromActionIfPossible(data) {
    if (!(data && data.profile && data.farmInfo && data.market && data.raidUpgrades && data.turret)) return false;
    state = data;
    render(data);
    return true;
  }

  async function refreshSoon(delay) {
    setTimeout(() => { loadMe(true).catch(() => {}); }, delay || 250);
  }

  async function doFarmUpgradeInstant(count, btn) {
    const data = await postJson('/api/farm/upgrade', { count });

    if (data?.error === 'stale_profile' || data?.error === 'action_in_progress' || data?.httpStatus === 409) {
      renderFromActionIfPossible(data);
      showMessage(`⏳ ${data.message || 'Профиль уже обновился. Подтягиваем свежие данные...'}`);
      await loadMe(true);
      return;
    }

    if (!data?.ok) {
      renderFromActionIfPossible(data);
      showMessage(farmUpgradeErrorMessage(data));
      await loadMe(true);
      return;
    }

    renderFromActionIfPossible(data);
    showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost || 0)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
    refreshSoon(300);
  }

  function bindLiveUpgradeButton(id, count) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.liveBind === '1') return;
    const clone = btn.cloneNode(true);
    clone.dataset.liveBind = '1';
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', async () => {
      const oldText = clone.innerHTML;
      if (clone.disabled) return;
      clone.disabled = true;
      clone.classList.add('is-busy');
      clone.innerHTML = '⏳ Выполняется...';
      try {
        await doFarmUpgradeInstant(count, clone);
      } finally {
        clone.disabled = false;
        clone.classList.remove('is-busy');
        clone.innerHTML = oldText;
      }
    });
  }

  const oldRenderLiveRefresh = render;
  render = function patchedRenderLiveRefresh(data) {
    oldRenderLiveRefresh(data);
    bindLiveUpgradeButton('upgrade1Btn', 1);
    bindLiveUpgradeButton('upgrade10Btn', 10);
  };
})();


