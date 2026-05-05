/* === HOTFIX: GAMUS mine bonus report + compact +10 building text === */
async function claimGamus() {
  const data = await postJson('/api/farm/gamus/claim');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ GAMUS через ${formatTime(data.remainingMs || 0)} (06:00 МСК)` : `❌ GAMUS: ${data.error}`);
    await loadMe();
    return;
  }

  const money = Number(data.money || 0);
  const parts = Number(data.parts || 0);
  const baseMoney = Number(data.baseMoney || (money - Number(data.mineBonusMoney || 0)));
  const baseParts = Number(data.baseParts || (parts - Number(data.mineBonusParts || 0)));
  const mineBonusMoney = Math.max(0, Number(data.mineBonusMoney || 0));
  const mineBonusParts = Math.max(0, Number(data.mineBonusParts || 0));
  const mineLevel = Number(data.effectiveMineLevel || data.mineLevel || 0);

  renderUnifiedReward('🎁 GAMUS получен', 'Бонус шахты уже включён в итоговую награду', [
    { label: '💎 Итог монет', value: `+${stageFormat(money)}` },
    { label: '🔧 Итог запчастей', value: `+${stageFormat(parts)}` },
    { label: '⛏ Бонус шахты', value: `+${stageFormat(mineBonusMoney)}💎 / +${stageFormat(mineBonusParts)}🔧` },
    { label: '📦 База', value: `${stageFormat(baseMoney)}💎 / ${stageFormat(baseParts)}🔧` },
    { label: '📈 Тир', value: stageFormat(data.tierLevel || 0) },
    { label: '⛏ Шахта', value: mineLevel ? `+${stageFormat(mineLevel)}%` : 'нет бонуса' }
  ]);

  showMessage(`🎁 GAMUS: +${stageFormat(money)}💎 и +${stageFormat(parts)}🔧 | шахта +${stageFormat(mineBonusMoney)}💎 / +${stageFormat(mineBonusParts)}🔧`);
  await loadMe();
}

function buildingPack10Note(afford10) {
  const count = Number(afford10?.count || 0);
  const coins = Number(afford10?.totalCoins || 0);
  const parts = Number(afford10?.totalParts || 0);
  const stop = afford10?.stop ? `<div class="pack10-stop">Стопор: ${afford10.stop}</div>` : '';
  return `<div class="stage-mini-note pack10-note">
    <div><span>Для +10ур доступно</span><b>${stageFormat(count)} ур.</b></div>
    <div><span>Цена 10ур</span><b>${stageFormat(coins)}💰 / ${stageFormat(parts)}🔧</b></div>
    ${stop}
  </div>`;
}

function renderBuildings(data) {
  const el = document.getElementById('buildings');
  if (!el) return;
  const p = data.profile || {};
  const buildingsConfig = p.configs?.buildings || {};
  const owned = (p.farm && p.farm.buildings) || {};
  const keys = Object.keys(buildingsConfig);
  if (!keys.length) { el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>'; return; }
  el.innerHTML = keys.map((key) => {
    const conf = buildingsConfig[key] || {};
    const lvl = Number(owned[key] || 0);
    const isBuilt = lvl > 0;
    const maxLevel = Number(conf.maxLevel || 0) || 0;
    const farmLevel = Number(p.level || 0);
    const requiredLevel = Number(conf.levelRequired || 0);
    const levelLocked = farmLevel < requiredLevel;
    const nextLevel = lvl + 1;
    const nextCost = calcBuildingCost(conf, nextLevel);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
    const reason = levelLocked ? `Нужен ${requiredLevel} уровень фермы, сейчас ${farmLevel}.` : maxed ? 'Здание уже на максимуме.' : affordAll.stop || 'Можно улучшать.';
    const nextBenefit = maxed ? 'максимум уже достигнут' : buildingNextBenefit(key, conf, lvl, nextLevel);
    const haveText = `${stageFormat(currentCoins(p))}💰 / ${stageFormat(p.parts || 0)}🔧`;
    return `
      <div class="building-card stage-building-card clean-building-card readable-building-card ${levelLocked ? 'locked-building' : 'ready-building'}">
        <div class="building-title-row">
          <h3>${conf.name || key}</h3>
          <span class="building-badge">${isBuilt ? `ур. ${lvl}${maxLevel ? '/' + maxLevel : ''}` : 'не построено'}</span>
        </div>
        <div class="building-info-line"><span>Требование</span><b>${requiredLevel ? `${requiredLevel} ур. фермы` : 'нет'}</b></div>
        <div class="building-info-line"><span>Статус</span><b>${reason}</b></div>
        <div class="building-info-line"><span>Следующий уровень</span><b>${maxed ? 'MAX' : nextLevel + ' ур.'}</b></div>
        <div class="building-cost-readable">
          <div><span>Цена</span><b>${stageFormat(nextCost.coins)}💰</b><b>${stageFormat(nextCost.parts)}🔧</b></div>
          <div><span>У тебя</span><b>${haveText}</b></div>
          <div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${stageFormat(affordAll.count)} ур.`}</b></div>
        </div>
        <div class="stage-benefit">✨ Следующий уровень: <b>${nextBenefit}</b></div>
        ${!levelLocked && !maxed ? buildingPack10Note(afford10) : `<div class="stage-mini-note warning">${reason}</div>`}
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}


/* ==========================================================================
   BIG POLISH PATCH: unified modals, case history, market/buildings/info polish,
   admin backup preview UI helpers.
   Appended as safe overrides so older code remains available.
   ========================================================================== */

