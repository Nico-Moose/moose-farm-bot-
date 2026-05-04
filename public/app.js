/* Moose Farm frontend entry is split into public/js/*.js.
   Final compatibility hotfixes live here because this file is loaded near the end of farm.html. */
(function(){
  if (window.__mooseFinalRealtimeFix20260505) return;
  window.__mooseFinalRealtimeFix20260505 = true;

  function isFarmTabActive(name) {
    return !!document.querySelector(`[data-farm-panel="${name}"]`)?.classList.contains('active');
  }

  function hasRenderablePayload(data) {
    return !!(data && data.profile && data.farmInfo && data.market && data.raidUpgrades && data.turret);
  }

  function applyRealtimeState(data) {
    if (!hasRenderablePayload(data)) return false;
    try {
      state = { ...(state || {}), ...data };
      render(state);
      if (isFarmTabActive('buildings') && typeof renderBuildings === 'function') {
        renderBuildings(state);
      }
      return true;
    } catch (e) {
      console.warn('[FINAL REALTIME APPLY]', e);
      return false;
    }
  }

  async function reconcileFresh() {
    try {
      const fresh = await loadMe(true);
      if (isFarmTabActive('buildings') && fresh && typeof renderBuildings === 'function') {
        renderBuildings(fresh);
      }
    } catch (e) {
      console.warn('[FINAL REALTIME RECONCILE]', e);
    }
  }

  const originalBuyBuilding = window.buyBuilding;
  if (typeof originalBuyBuilding === 'function') {
    window.buyBuilding = async function finalBuyBuilding(key) {
      const data = await postJson('/api/farm/building/buy', { key, expectedUpdatedAt: Number(state?.profile?.updated_at || 0) || undefined });

      if (!data.ok) {
        const p = data.profile || state?.profile || {};
        const b = (data.buildings || []).find((item) => item.key === key);
        const needCoins = Number(data.totalCost || b?.buyCost?.coins || 0);
        const needParts = Number(data.totalParts || b?.buyCost?.parts || 0);
        const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
        if (!applyRealtimeState(data)) await reconcileFresh();
        showMessage(`❌ Здание не куплено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
        return;
      }

      applyRealtimeState(data);
      showMessage(`✅ Куплено: ${data.name || data.building}. Потрачено: ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
      setTimeout(reconcileFresh, 80);
    };
  }

  const originalUpgradeBuilding = window.upgradeBuilding;
  if (typeof originalUpgradeBuilding === 'function') {
    window.upgradeBuilding = async function finalUpgradeBuilding(key, count) {
      const data = await postJson('/api/farm/building/upgrade', { key, count, expectedUpdatedAt: Number(state?.profile?.updated_at || 0) || undefined });

      if (!data.ok) {
        const p = data.profile || state?.profile || {};
        const b = (data.buildings || []).find((item) => item.key === key);
        const needCoins = Number(b?.upgradeCost?.coins || data.nextCost || 0);
        const needParts = Number(b?.upgradeCost?.parts || data.nextParts || 0);
        const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
        if (!applyRealtimeState(data)) await reconcileFresh();
        showMessage(`❌ Здание не улучшено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
        return;
      }

      applyRealtimeState(data);
      showMessage(`⬆️ ${data.name || data.building}: +${data.upgraded || 0} ур. Потрачено: ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
      setTimeout(reconcileFresh, 80);
    };
  }

  const originalUpgradeRaidPower = window.upgradeRaidPower;
  if (typeof originalUpgradeRaidPower === 'function') {
    window.upgradeRaidPower = async function finalUpgradeRaidPower(count) {
      const data = await postJson('/api/farm/raid-power/upgrade', { count, expectedUpdatedAt: Number(state?.profile?.updated_at || 0) || undefined });
      if (!data.ok) {
        if (!applyRealtimeState(data)) await reconcileFresh();
        const labels = {
          farm_level_too_low: `доступно с ${data?.requiredLevel || 120} уровня фермы`,
          max_level: 'рейд-сила уже максимальная',
          not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
        };
        showMessage(`❌ Рейд-сила: ${labels[data?.error] || data?.error || 'ошибка'}`);
        return;
      }
      applyRealtimeState(data);
      showMessage(`⚔️ Рейд-сила +${data.upgraded || count || 1}. Новый уровень: ${formatNumber(data.level || 0)}. Потрачено ${formatNumber(data.totalCost || 0)}💎`);
      setTimeout(reconcileFresh, 80);
    };
  }

  const originalUpgradeProtection = window.upgradeProtection;
  if (typeof originalUpgradeProtection === 'function') {
    window.upgradeProtection = async function finalUpgradeProtection(count) {
      const data = await postJson('/api/farm/protection/upgrade', { count, expectedUpdatedAt: Number(state?.profile?.updated_at || 0) || undefined });
      if (!data.ok) {
        if (!applyRealtimeState(data)) await reconcileFresh();
        const labels = {
          farm_level_too_low: `доступно с ${data?.requiredLevel || 120} уровня фермы`,
          max_level: 'защита уже максимальная',
          not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
        };
        showMessage(`❌ Защита: ${labels[data?.error] || data?.error || 'ошибка'}`);
        return;
      }
      applyRealtimeState(data);
      showMessage(`🛡 Защита +${data.upgraded || count || 1}. Новый уровень: ${formatNumber(data.level || 0)}. Потрачено ${formatNumber(data.totalCost || 0)}💎`);
      setTimeout(reconcileFresh, 80);
    };
  }

  const originalUpgradeTurret = window.upgradeTurret;
  if (typeof originalUpgradeTurret === 'function') {
    window.upgradeTurret = async function finalUpgradeTurret() {
      const data = await postJson('/api/farm/turret/upgrade', { expectedUpdatedAt: Number(state?.profile?.updated_at || 0) || undefined });
      if (!data.ok) {
        if (!applyRealtimeState(data)) await reconcileFresh();
        const labels = {
          max_level: 'турель уже максимальная',
          not_enough_money: `не хватает монет: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`,
          not_enough_parts: `не хватает запчастей: сейчас ${formatNumber(data?.available || 0)} / нужно ${formatNumber(data?.needed || 0)}`
        };
        showMessage(`❌ Турель: ${labels[data?.error] || data?.error || 'ошибка'}`);
        return;
      }
      applyRealtimeState(data);
      showMessage(`🔫 Турель улучшена. Новый уровень: ${formatNumber(data.level || 0)}. Потрачено ${formatNumber(data.totalCost || 0)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
      setTimeout(reconcileFresh, 80);
    };
  }
})();
