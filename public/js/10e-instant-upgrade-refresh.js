/* Extracted from 10-final-patches.js lines 918-1223. Safe split, logic unchanged. */
/* ==========================================================================
   FINAL HOTFIX: instant farm level refresh without F5
   ========================================================================== */
(function(){
  function mergeLiveState(data) {
    const prev = state || {};
    const next = data || {};
    return {
      ...prev,
      ...next,
      user: next.user || prev.user || null,
      streamStatus: next.streamStatus || prev.streamStatus || {},
      streamOnline: Object.prototype.hasOwnProperty.call(next, 'streamOnline') ? next.streamOnline : prev.streamOnline,
      harvestManagedByWizebot: Object.prototype.hasOwnProperty.call(next, 'harvestManagedByWizebot') ? next.harvestManagedByWizebot : prev.harvestManagedByWizebot,
    };
  }

  function applyLiveActionState(data) {
    if (!data || !data.profile) return false;
    const merged = mergeLiveState(data);
    state = merged;
    try {
      render(merged);
      return true;
    } catch (e) {
      console.warn('[LIVE APPLY]', e);
      return false;
    }
  }

  async function runFarmUpgradeLive(count) {
    const data = await postJson('/api/farm/upgrade', { count });

    if (data?.error === 'stale_profile' || data?.error === 'action_in_progress' || data?.httpStatus === 409) {
      applyLiveActionState(data);
      showMessage(`⏳ ${data.message || 'Профиль обновился. Подтягиваем свежие данные...'}`);
      await loadMe(true);
      return;
    }

    if (!data?.ok) {
      applyLiveActionState(data);
      showMessage(farmUpgradeErrorMessage(data));
      await loadMe(true);
      return;
    }

    applyLiveActionState(data);
    showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost || 0)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
    setTimeout(() => { loadMe(true).catch(() => {}); }, 180);
  }

  async function bindFinalFarmUpgradeButton(id, count) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.finalFarmLiveBind === '1') return;

    const clone = btn.cloneNode(true);
    clone.dataset.finalFarmLiveBind = '1';
    btn.parentNode.replaceChild(clone, btn);

    clone.addEventListener('click', async () => {
      if (clone.disabled) return;

      const oldHtml = clone.innerHTML;
      clone.disabled = true;
      clone.classList.add('is-busy');
      clone.innerHTML = '⏳ Выполняется...';

      try {
        await runFarmUpgradeLive(count);
      } finally {
        clone.disabled = false;
        clone.classList.remove('is-busy');
        clone.innerHTML = oldHtml;
      }
    });
  }

  const prevRender = render;
  render = function patchedRenderFinalLive(data) {
    const merged = mergeLiveState(data);
    prevRender(merged);
    bindFinalFarmUpgradeButton('upgrade1Btn', 1);
    bindFinalFarmUpgradeButton('upgrade10Btn', 10);
  };
})();

/* ==========================================================================
   HOTFIX 2026-05-04: keep current visual, fix live upgrade actions only
   - buildings buy/upgrade
   - raid power / protection / turret upgrades
   - instant repaint like farm upgrade
   ========================================================================== */
(function(){
  if (window.__mooseActionLiveFix20260504) return;
  window.__mooseActionLiveFix20260504 = true;

  const busyKeys = new Set();

  function getExpectedBody(body) {
    const updatedAt = Number(state?.profile?.updated_at || 0);
    if (!updatedAt) return { ...(body || {}) };
    return { ...(body || {}), expectedUpdatedAt: updatedAt };
  }

  function hasFullPayload(data) {
    return !!(data && data.profile && data.farmInfo && data.market && data.raidUpgrades && data.turret);
  }

  function mergeForRender(data) {
    if (!data || !data.profile) return false;
    const prev = state || {};
    const merged = {
      ...prev,
      ...data,
      profile: data.profile || prev.profile || {},
      farmInfo: data.farmInfo || prev.farmInfo || {},
      market: data.market || prev.market || {},
      raidUpgrades: data.raidUpgrades || prev.raidUpgrades || {},
      turret: data.turret || prev.turret || {},
      raid: data.raid || prev.raid || {},
      nextUpgrade: data.nextUpgrade || prev.nextUpgrade || {},
      nextLicense: data.nextLicense || prev.nextLicense || {},
      caseStatus: data.caseStatus || prev.caseStatus || {},
      gamus: data.gamus || prev.gamus || {},
      raidInfo: data.raidInfo || prev.raidInfo || {},
      streamStatus: data.streamStatus || prev.streamStatus || {},
      streamOnline: Object.prototype.hasOwnProperty.call(data, 'streamOnline') ? data.streamOnline : prev.streamOnline,
      harvestManagedByWizebot: Object.prototype.hasOwnProperty.call(data, 'harvestManagedByWizebot') ? data.harvestManagedByWizebot : prev.harvestManagedByWizebot
    };

    state = merged;
    try {
      render(merged);
      return true;
    } catch (e) {
      console.warn('[ACTION LIVE FIX render]', e);
      return false;
    }
  }

  async function postWithRetry(url, body) {
    let data = await postJson(url, getExpectedBody(body));

    if (data?.error === 'stale_profile') {
      mergeForRender(data);
      data = await postJson(url, getExpectedBody(body));
    }

    return data;
  }

  function buildingFailMessage(key, data) {
    const reason = buildingErrorLabel(data?.error || data?.stopReason, data || {});
    return `❌ ${key}: ${reason || 'ошибка'}`;
  }

  function raidPowerFailMessage(data) {
    const labels = {
      farm_level_too_low: `доступно с ${data?.requiredLevel || 120} уровня фермы`,
      max_level: 'рейд-сила уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
    };
    return `❌ Рейд-сила: ${labels[data?.error] || data?.error || 'ошибка'}`;
  }

  function protectionFailMessage(data) {
    const labels = {
      farm_level_too_low: `доступно с ${data?.requiredLevel || 120} уровня фермы`,
      max_level: 'защита уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
    };
    return `❌ Защита: ${labels[data?.error] || data?.error || 'ошибка'}`;
  }

  function turretFailMessage(data) {
    const labels = {
      max_level: 'турель уже максимальная',
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`,
      not_enough_parts: `не хватает запчастей: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
    };
    return `❌ Турель: ${labels[data?.error] || data?.error || 'ошибка'}`;
  }

  async function finalizeAction(data, successMessage, failMessage) {
    if (data?.error === 'action_in_progress') {
      if (!mergeForRender(data)) await loadMe(true);
      showMessage(`⏳ ${data?.message || 'Действие уже выполняется. Обновили данные.'}`);
      return;
    }

    if (!data?.ok) {
      if (!mergeForRender(data)) await loadMe(true);
      showMessage(failMessage);
      return;
    }

    if (!hasFullPayload(data)) {
      await loadMe(true);
    } else {
      mergeForRender(data);
    }

    showMessage(successMessage);
  }

  async function runAction(btn, key, runner) {
    if (!btn || btn.disabled) return;
    if (busyKeys.has(key)) {
      showMessage('⏳ Действие уже выполняется. Подожди ответ сервера.');
      return;
    }

    busyKeys.add(key);
    const oldHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-busy');
    btn.innerHTML = '⏳ Выполняется...';

    try {
      await runner();
    } finally {
      busyKeys.delete(key);
      btn.disabled = false;
      btn.classList.remove('is-busy');
      btn.innerHTML = oldHtml;
    }
  }

  document.addEventListener('click', function(event) {
    const btn = event.target.closest('[data-building-buy], [data-building-upgrade], [data-raid-power], [data-protection], #turretUpgradeBtn');
    if (!btn) return;

    // Не даём старым кривым обработчикам ломать live-refresh.
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

    if (btn.matches('[data-building-buy]')) {
      const key = btn.getAttribute('data-building-buy');
      runAction(btn, 'building-buy:' + key, async () => {
        const data = await postWithRetry('/api/farm/building/buy', { key });
        await finalizeAction(
          data,
          `🏗 ${data?.name || key}: построено. Потрачено ${formatNumber(data?.totalCost || 0)}💰 / ${formatNumber(data?.totalParts || 0)}🔧`,
          buildingFailMessage(key, data)
        );
      });
      return;
    }

    if (btn.matches('[data-building-upgrade]')) {
      const key = btn.getAttribute('data-building-upgrade');
      const count = Number(btn.getAttribute('data-count') || 1);
      runAction(btn, `building-upgrade:${key}:${count}`, async () => {
        const data = await postWithRetry('/api/farm/building/upgrade', { key, count });
        await finalizeAction(
          data,
          `🏗 ${data?.name || key}: +${formatNumber(data?.upgraded || 0)} ур. Потрачено ${formatNumber(data?.totalCost || 0)}💰 / ${formatNumber(data?.totalParts || 0)}🔧`,
          buildingFailMessage(key, data)
        );
      });
      return;
    }

    if (btn.matches('[data-raid-power]')) {
      const count = Number(btn.getAttribute('data-raid-power') || 1);
      runAction(btn, `raid-power:${count}`, async () => {
        const data = await postWithRetry('/api/farm/raid-power/upgrade', { count });
        await finalizeAction(
          data,
          `⚔️ Рейд-сила +${formatNumber(data?.upgraded || 0)}. Новый уровень: ${formatNumber(data?.level || 0)}. Потрачено ${formatNumber(data?.totalCost || 0)}💎`,
          raidPowerFailMessage(data)
        );
      });
      return;
    }

    if (btn.matches('[data-protection]')) {
      const count = Number(btn.getAttribute('data-protection') || 1);
      runAction(btn, `protection:${count}`, async () => {
        const data = await postWithRetry('/api/farm/protection/upgrade', { count });
        await finalizeAction(
          data,
          `🛡 Защита +${formatNumber(data?.upgraded || 0)}. Новый уровень: ${formatNumber(data?.level || 0)}. Потрачено ${formatNumber(data?.totalCost || 0)}💎`,
          protectionFailMessage(data)
        );
      });
      return;
    }

    if (btn.matches('#turretUpgradeBtn')) {
      runAction(btn, 'turret-upgrade', async () => {
        const data = await postWithRetry('/api/farm/turret/upgrade', {});
        await finalizeAction(
          data,
          `🔫 Турель улучшена до ${formatNumber(data?.level || 0)} ур. Потрачено ${formatNumber(data?.totalCost || 0)}💰 / ${formatNumber(data?.totalParts || 0)}🔧`,
          turretFailMessage(data)
        );
      });
    }
  }, true);
})();


