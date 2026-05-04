/* Moose Farm frontend split module: здания: базовый рендер
   Safe-refactor: extracted from public/app.js without logic changes. */
function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;

  const p = data.profile || {};
  const configs = p.configs || {};
  const buildingsConfig = configs.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);

  if (!keys.length) {
    el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>';
    return;
  }

  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0);
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const buyCoins = Number(conf.baseCost || 0);
    const buyParts = Number(conf.partsBase || 0);
    const nextLevel = lvl + 1;
    const upgradeCoins = buyCoins + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
    const upgradeParts = buyParts + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    const shownCoins = isBuilt ? upgradeCoins : buyCoins;
    const shownParts = isBuilt ? upgradeParts : buyParts;
    const st = resourceStatus(p, shownCoins, shownParts);
    const shortage = [];
    if (!st.coinsOk) shortage.push(`💰 не хватает ${formatNumber(st.missingCoins)}`);
    if (!st.partsOk) shortage.push(`🔧 не хватает ${formatNumber(st.missingParts)}`);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const cardClass = levelLocked ? 'building-card locked-building' : shortage.length ? 'building-card shortage-building' : 'building-card ready-building';
    const subtitle = levelLocked
      ? `🔒 Нужен уровень фермы ${requiredLevel}. Сейчас ${farmLevel}.`
      : isBuilt
        ? (maxed ? '✅ Максимальный уровень' : `Следующий ап до ${nextLevel} ур.`)
        : 'Можно построить';

    return `
      <div class="${cardClass}">
        <div class="building-title-row">
          <h3>${conf.name || key}</h3>
          <span class="building-badge">${isBuilt ? 'ур. ' + lvl + (maxLevel ? '/' + maxLevel : '') : 'не построено'}</span>
        </div>
        <p class="building-subtitle">${subtitle}</p>
        <div class="building-cost-box">
          <span>Цена</span>
          <b>${formatNumber(shownCoins)}💰</b>
          <b>${formatNumber(shownParts)}🔧</b>
        </div>
        <div class="building-wallet-box">
          <span>У тебя</span>
          <b>${formatNumber(st.coins)}💰</b>
          <b>${formatNumber(st.parts)}🔧</b>
        </div>
        ${levelLocked ? `<p class="shortage">Недоступно: нужен ${requiredLevel} уровень фермы</p>` : ''}
        ${!levelLocked && shortage.length ? `<p class="shortage">${shortage.join(' · ')}</p>` : ''}
        ${!levelLocked && !shortage.length && !maxed ? '<p class="okline">Ресурсов хватает ✅</p>' : ''}
        ${!isBuilt
          ? `<button data-building-buy="${key}" data-required-level="${requiredLevel}" ${levelLocked ? 'disabled' : ''}>🏗 Купить</button>`
          : `
            <div class="building-actions">
              <button data-building-upgrade="${key}" data-count="1" ${maxed ? 'disabled' : ''}>⬆️ Ап +1</button>
              <button data-building-upgrade="${key}" data-count="10" ${maxed ? 'disabled' : ''}>⬆️ Ап +10</button>
            </div>
          `}
      </div>
    `;
  }).join('');

  document.querySelectorAll('[data-building-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const required = Number(btn.getAttribute('data-required-level') || 0);
      const current = Number(state?.profile?.level || 0);
      if (current < required) {
        showMessage(`⛔ Здание пока недоступно: нужен уровень фермы ${required}, сейчас ${current}.`);
        return;
      }
      await buyBuilding(btn.getAttribute('data-building-buy'));
    });
  });

  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await upgradeBuilding(
        btn.getAttribute('data-building-upgrade'),
        Number(btn.getAttribute('data-count') || 1)
      );
    });
  });
}
