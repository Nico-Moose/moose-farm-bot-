/* Moose Farm frontend entry is split into public/js/*.js.
   Keep this file as a tiny compatibility placeholder.
   Logic was moved without behavior changes in README-PATCH/README_FRONTEND_TABS_MODULE_SPLIT.md. */


(function(){
  function currentPanel() {
    return document.querySelector('.farm-tab-panel.active')?.getAttribute('data-farm-panel') || 'main';
  }

  function validNextLicense(data) {
    const level = Number(data?.profile?.license_level || 0);
    const next = data?.nextLicense || null;
    const nextLevel = Number(next?.level || 0);
    const nextCost = Number(next?.cost || 0);
    if (level >= 120) return false;
    if (!next) return false;
    if (!Number.isFinite(nextLevel) || nextLevel <= level) return false;
    if (!Number.isFinite(nextCost) || nextCost <= 0) return false;
    return true;
  }

  function fixLicenseBox(data) {
    const box = document.getElementById('licenseBox');
    if (!box) return;
    if (!validNextLicense(data)) {
      box.innerHTML = '';
      box.style.display = 'none';
      box.classList.add('hidden');
      return;
    }
    box.style.display = '';
    box.classList.remove('hidden');
  }

  function fixFarmButtons(data) {
    const isMax = Number(data?.profile?.level || 0) >= 120 || !data?.nextUpgrade;
    ['upgrade1Btn', 'upgrade10Btn'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = !!isMax;
      btn.classList.toggle('farm-max-disabled', !!isMax);
      btn.title = isMax ? 'Ферма уже максимального уровня' : '';
    });
    const text = document.getElementById('upgrade1Text');
    if (text && isMax) text.textContent = 'максимум';
  }

  function fixCombatButtons(data) {
    const raid = data?.raidUpgrades?.raidPower || {};
    const protection = data?.raidUpgrades?.protection || {};
    const turret = data?.turret || {};
    const raidDisabled = !raid.unlocked || !Number(raid.nextCost || 0) || (Number(raid.maxLevel || 0) > 0 && Number(raid.level || 0) >= Number(raid.maxLevel || 0));
    const protectionDisabled = !protection.unlocked || !Number(protection.nextCost || 0) || (Number(protection.maxLevel || 0) > 0 && Number(protection.level || 0) >= Number(protection.maxLevel || 0));
    document.querySelectorAll('[data-raid-power]').forEach((btn) => { btn.disabled = raidDisabled; });
    document.querySelectorAll('[data-protection]').forEach((btn) => { btn.disabled = protectionDisabled; });
    const turretBtn = document.getElementById('turretUpgradeBtn');
    if (turretBtn) turretBtn.disabled = !turret.nextUpgrade;
  }

  function fixBuildingsPanel(data) {
    if (currentPanel() !== 'buildings') return;
    if (typeof refreshBuildingsIfVisible === 'function') {
      refreshBuildingsIfVisible(true);
      return;
    }
    const box = document.getElementById('buildings');
    if (box && !box.innerHTML.trim() && typeof renderBuildings === 'function') {
      renderBuildings(data || state || {});
    }
  }

  const prevRender = typeof render === 'function' ? render : null;
  if (prevRender && !window.__mooseFinalUiStabilizer20260505) {
    window.__mooseFinalUiStabilizer20260505 = true;
    render = function stableRender(data) {
      prevRender(data);
      try { fixFarmButtons(data || state || {}); } catch (e) { console.warn('[FARM BUTTON FIX]', e); }
      try { fixLicenseBox(data || state || {}); } catch (e) { console.warn('[LICENSE FIX]', e); }
      try { fixCombatButtons(data || state || {}); } catch (e) { console.warn('[COMBAT FIX]', e); }
      try { fixBuildingsPanel(data || state || {}); } catch (e) { console.warn('[BUILDINGS FIX]', e); }
    };
  }
})();
