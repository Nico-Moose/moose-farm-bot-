/* Extracted from 10-final-patches.js lines 281-603. Safe split, logic unchanged. */
/* ==========================================================================
   PATCH: screenshots feedback cleanup
   1) cleaner building cards/order, no duplicated stopper/status text
   2) compact raid/turret result breakdown
   3) 409 conflict hardening + button locks
   4) responsive building layout fixes
   5) friendly hero greeting
   ========================================================================== */
(function(){
  const actionLocks = new Set();

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function buildingSortKey(key) {
    const order = ['завод', 'фабрика', 'шахта', 'кузница', 'укрепления', 'глушилка', 'центр'];
    const idx = order.indexOf(String(key || '').toLowerCase());
    return idx === -1 ? 999 : idx;
  }

  function shortBuildingEffect(key, conf = {}, nextLevel = 1) {
    key = String(key || '').toLowerCase();
    const lvl = Number(nextLevel || 1);
    if (key === 'завод') return `производство запчастей: +${formatNumber(Number(conf.perLevel || 0) || 25)}🔧/ч`;
    if (key === 'фабрика') return `усилит производство запчастей`;
    if (key === 'кузница') return `больше оружия для рейдов`;
    if (key === 'шахта') return `усилит бонусы и запчасти: +${lvl}%`;
    if (key === 'укрепления') return `больше щита для защиты`;
    if (key === 'глушилка') return `снизит шанс турели цели на ${lvl * 5}%`;
    if (key === 'центр') return `сократит кулдаун рейдов`;
    return buildingNextBenefit ? buildingNextBenefit(key, conf, lvl - 1, lvl) : 'усилит здание';
  }

  function missingLine(profile, needCoins, needParts) {
    const coins = currentCoins(profile);
    const parts = Number(profile?.parts || 0);
    const missCoins = Math.max(0, Number(needCoins || 0) - coins);
    const missParts = Math.max(0, Number(needParts || 0) - parts);
    const bits = [];
    if (missCoins > 0) bits.push(`${formatNumber(missCoins)}💰`);
    if (missParts > 0) bits.push(`${formatNumber(missParts)}🔧`);
    return bits.length ? `не хватает ${bits.join(' и ')}` : 'ресурсов хватает';
  }

  function compactStopReason(profile, conf, currentLevel, requiredLevel, maxed) {
    const farmLevel = Number(profile?.level || 0);
    if (requiredLevel && farmLevel < requiredLevel) {
      return `нужен ${requiredLevel} ур. фермы`;
    }
    if (maxed) return 'максимальный уровень';
    const next = Number(currentLevel || 0) + 1;
    const cost = calcBuildingCost(conf, next);
    const miss = missingLine(profile, cost.coins, cost.parts);
    if (miss === 'ресурсов хватает') return 'можно улучшать';
    return miss;
  }

  function pack10Line(afford10 = {}) {
    const count = Number(afford10.count || 0);
    if (count <= 0) return '';
    return `<span>+10 доступно: <b>${formatNumber(count)} ур.</b></span>`;
  }

  function renderBuildingsQuickStatus(data) {
    const box = document.getElementById('buildingsResourcesSection');
    if (!box) return;
    box.dataset.loaded = '1';
    const profile = data.profile || {};
    box.innerHTML = `
      <div><b>Текущие ресурсы</b></div>
      <div class="quick-status-grid compact-stats">
        <span>💰 Голда: <b>${formatNumber(ordinaryCoins(profile))}</b></span>
        <span>🌾 Ферма: <b>${formatNumber(farmCoins(profile))}</b></span>
        <span>💎 Бонусные: <b>${formatNumber(bonusCoins(profile))}</b></span>
        <span>🔧 Запчасти: <b>${formatNumber(profile.parts || 0)}</b></span>
      </div>
    `;
  }

  renderBuildings = function renderBuildings(data) {
    const el = document.getElementById('buildings');
    if (!el) return;
    el.dataset.loaded = '1';
    renderBuildingsQuickStatus(data);
    const p = data.profile || {};
    const buildingsConfig = p.configs?.buildings || {};
    const owned = (p.farm && p.farm.buildings) || {};
    const keys = Object.keys(buildingsConfig).sort((a, b) => buildingSortKey(a) - buildingSortKey(b));
    if (!keys.length) {
      el.innerHTML = '<p>Нет данных зданий. Сделай !синкферма.</p>';
      return;
    }

    el.innerHTML = `<div class="buildings-grid-clean">${keys.map((key) => {
      const conf = buildingsConfig[key] || {};
      const lvl = Number(owned[key] || 0);
      const isBuilt = lvl > 0;
      const maxLevel = Number(conf.maxLevel || 0) || 0;
      const farmLevel = Number(p.level || 0);
      const requiredLevel = Number(conf.levelRequired || 0);
      const levelLocked = requiredLevel > 0 && farmLevel < requiredLevel;
      const nextLevel = lvl + 1;
      const nextCost = calcBuildingCost(conf, nextLevel);
      const maxed = isBuilt && maxLevel && lvl >= maxLevel;
      const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
      const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
      const status = compactStopReason(p, conf, lvl, requiredLevel, maxed);
      const ready = !levelLocked && !maxed && status === 'можно улучшать';
      const cardState = maxed ? 'maxed' : levelLocked ? 'locked' : ready ? 'ready' : 'blocked';
      const reqText = requiredLevel ? `${requiredLevel} ур. фермы` : 'нет';
      const nextLabel = maxed ? 'MAX' : `${nextLevel} ур.`;
      const effect = maxed ? 'здание уже на максимуме' : shortBuildingEffect(key, conf, nextLevel);

      return `
        <div class="building-card building-card-v3 ${cardState}">
          <div class="building-head-v3">
            <h3>${escapeHtml(conf.name || key)}</h3>
            <span class="building-level-pill">${isBuilt ? `ур. ${formatNumber(lvl)}${maxLevel ? '/' + formatNumber(maxLevel) : ''}` : 'не построено'}</span>
          </div>

          <div class="building-summary-v3">
            <div><span>Требование</span><b>${reqText}</b></div>
            <div><span>Статус</span><b>${status}</b></div>
          </div>

          <div class="building-main-v3">
            <div><span>След. ур.</span><b>${nextLabel}</b></div>
            <div><span>Цена</span><b>${formatNumber(nextCost.coins)}💰</b><b>${formatNumber(nextCost.parts)}🔧</b></div>
            <div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${formatNumber(affordAll.count)} ур.`}</b></div>
          </div>

          <div class="building-effect-v3">✨ ${effect}</div>
          <div class="building-pack-v3">${pack10Line(afford10)}</div>

          <div class="building-actions building-actions-v3">
            ${!isBuilt
              ? `<button type="button" data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${escapeHtml(status)}">🏗 Купить</button>`
              : `<button type="button" data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''}>⬆️ Ап +1</button><button type="button" data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''}>🚀 Ап +10</button>`}
          </div>
        </div>`;
    }).join('')}</div>`;

    document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => {
      await withButtonLock(btn, 'building-buy:' + btn.getAttribute('data-building-buy'), () => buyBuilding(btn.getAttribute('data-building-buy')));
    }));
    document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => {
      await withButtonLock(btn, 'building-upgrade:' + btn.getAttribute('data-building-upgrade'), () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1)));
    }));
  };

  function conflictText(data = {}) {
    if (data.error === 'action_in_progress' || data.status === 409 || data.httpStatus === 409) {
      return data.message || 'Действие уже выполняется. Дождись завершения предыдущего клика.';
    }
    return null;
  }

  postJson = async function postJson(url, body = {}) {
    const lockKey = url + ':' + JSON.stringify(body || {});
    if (actionLocks.has(lockKey)) {
      return { ok: false, error: 'action_in_progress', httpStatus: 409, message: 'Действие уже выполняется. Подожди завершения предыдущего клика.' };
    }
    actionLocks.add(lockKey);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { ok: false, error: 'bad_json_response', raw: text }; }
      data.httpStatus = res.status;
      if (!res.ok && data.ok !== false) {
        data.ok = false;
        data.error = res.status === 409 ? 'action_in_progress' : `http_${res.status}`;
      }
      return data;
    } finally {
      actionLocks.delete(lockKey);
    }
  };

  async function withButtonLock(btn, key, fn) {
    if (actionLocks.has(key)) {
      showMessage('⏳ Действие уже выполняется. Подожди ответ сервера.');
      return;
    }
    actionLocks.add(key);
    const oldText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-busy');
      btn.innerHTML = '⏳ Выполняется...';
    }
    try {
      await fn();
    } finally {
      actionLocks.delete(key);
      if (btn) {
        btn.classList.remove('is-busy');
        btn.disabled = false;
        btn.innerHTML = oldText;
      }
    }
  }

  async function handleConflictOrError(data, fallback) {
    const conflict = conflictText(data);
    if (conflict) {
      showMessage(`⏳ ${conflict} Данные обновлены.`);
      await loadMe(true);
      return true;
    }
    if (!data.ok) {
      showMessage(fallback);
      await loadMe(true);
      return true;
    }
    return false;
  }

  upgradeRaidPower = async function upgradeRaidPower(count) {
    const data = await postJson('/api/farm/raid-power/upgrade', { count });
    if (await handleConflictOrError(data, `❌ Рейд-сила не улучшена: ${data.error || 'ошибка'}`)) return;
    showMessage(`⚔️ Рейд-сила +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎`);
    await loadMe(true);
  };

  upgradeProtection = async function upgradeProtection(count) {
    const data = await postJson('/api/farm/protection/upgrade', { count });
    if (await handleConflictOrError(data, `❌ Защита не улучшена: ${data.error || 'ошибка'}`)) return;
    showMessage(`🛡 Защита +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎`);
    await loadMe(true);
  };

  upgradeTurret = async function upgradeTurret() {
    const data = await postJson('/api/farm/turret/upgrade');
    if (await handleConflictOrError(data, `❌ Турель не улучшена: ${data.error || 'ошибка'}`)) return;
    showMessage(`🔫 Турель улучшена до ${data.level} ур. Потрачено ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
    await loadMe(true);
  };

  renderCombat = function renderCombat(data) {
    const box = document.getElementById('combatBox');
    if (!box) return;
    const p = data.profile || {};
    const raidPower = data.raidUpgrades?.raidPower || {};
    const protection = data.raidUpgrades?.protection || {};
    const turret = data.turret || {};
    box.innerHTML = `
      <div class="combat-grid-v3">
        <div class="combat-card combat-card-v3">
          <h3>⚔️ Рейд-сила</h3>
          <div class="combat-big">${formatNumber(raidPower.level || 0)}<small>/${formatNumber(raidPower.maxLevel || 200)}</small></div>
          <p>Следующий: <b>${raidPower.nextCost ? formatNumber(raidPower.nextCost) + '💎' : 'MAX'}</b></p>
          <p class="muted">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b></p>
          <div class="building-actions"><button type="button" data-raid-power="1" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +1</button><button type="button" data-raid-power="10" ${!raidPower.unlocked ? 'disabled' : ''}>🚀 +10</button></div>
        </div>
        <div class="combat-card combat-card-v3">
          <h3>🛡 Защита</h3>
          <div class="combat-big">${formatNumber(protection.level || 0)}<small>/${formatNumber(protection.maxLevel || 120)}</small></div>
          <p>Сейчас: <b>${Number(protection.percent || 0).toFixed(1)}%</b></p>
          <p>Следующий: <b>${protection.nextCost ? formatNumber(protection.nextCost) + '💎' : 'MAX'}</b></p>
          <div class="building-actions"><button type="button" data-protection="1" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +1</button><button type="button" data-protection="10" ${!protection.unlocked ? 'disabled' : ''}>🚀 +10</button></div>
        </div>
        <div class="combat-card combat-card-v3">
          <h3>🔫 Турель</h3>
          <div class="combat-big">${formatNumber(turret.level || 0)}<small>/${formatNumber(turret.maxLevel || 20)}</small></div>
          <p>Шанс: <b>${formatNumber(turret.chance || 0)}%</b></p>
          <p>Следующий: <b>${turret.nextUpgrade ? formatNumber(turret.nextUpgrade.chance || 0) + '%' : 'MAX'}</b></p>
          <p class="muted">Цена: ${turret.nextUpgrade ? `${formatNumber(turret.nextUpgrade.cost || 0)}💰 / ${formatNumber(turret.nextUpgrade.parts || 0)}🔧` : '—'}</p>
          <button type="button" id="turretUpgradeBtn" ${turret.nextUpgrade ? '' : 'disabled'}>🔫 Улучшить турель</button>
        </div>
      </div>`;
    document.querySelectorAll('[data-raid-power]').forEach((btn) => btn.addEventListener('click', () => withButtonLock(btn, 'raid-power', () => upgradeRaidPower(Number(btn.dataset.raidPower || 1)))));
    document.querySelectorAll('[data-protection]').forEach((btn) => btn.addEventListener('click', () => withButtonLock(btn, 'protection', () => upgradeProtection(Number(btn.dataset.protection || 1)))));
    document.getElementById('turretUpgradeBtn')?.addEventListener('click', (e) => withButtonLock(e.currentTarget, 'turret', upgradeTurret));
  };

  showRaidDetails = function showRaidDetails(log = {}) {
    const target = log.target || 'неизвестно';
    const attacker = log.attacker || 'игрок';
    const turretBlocked = !!(log.raid_blocked_by_turret || log.killed_by_turret || log.turret_triggered);
    const bonus = Number(log.bonus_stolen || 0) + Number(log.turret_bonus || 0);
    const title = turretBlocked ? '🔫 Рейд отбит турелью' : '🏴 Рейд выполнен';
    const subtitle = `${escapeHtml(attacker)} → ${escapeHtml(target)}`;
    const body = `
      <div class="raid-breakdown-grid">
        <div><span>Итог монет</span><b>${turretBlocked ? '-' : '+'}${formatNumber(Math.abs(Number(log.stolen || log.turret_refund || 0)))}💰</b></div>
        <div><span>Бонусные</span><b>${bonus ? formatNumber(bonus) + '💎' : '0💎'}</b></div>
        <div><span>Сила атаки</span><b>${formatNumber(log.strength || 0)}%</b></div>
      </div>
      <details class="raid-details-more" open>
        <summary>Подробная сводка</summary>
        <div class="raid-rows-clean">
          <div><span>🎯 Цель</span><b>${escapeHtml(target)}</b></div>
          <div><span>📈 Базовый доход цели</span><b>${formatNumber(log.base_income || 0)}💰</b></div>
          <div><span>🛡 Щит/защита заблокировали</span><b>${formatNumber(log.blocked || 0)}💰</b></div>
          <div><span>🚨 AFK-множитель</span><b>x${log.punish_mult || 1}</b></div>
          <div><span>🔫 Шанс турели</span><b>${formatNumber(log.turret_chance || 0)}%</b></div>
          <div><span>💥 Турель списала</span><b>${formatNumber(log.turret_refund || 0)}💰</b></div>
        </div>
      </details>`;
    unifiedModal(title, subtitle, body, { kind: turretBlocked ? 'danger' : 'raid', wide: false });
  };

  const oldRender = typeof render === 'function' ? render : null;
  if (oldRender && !window.__mooseGreetingRenderPatch) {
    window.__mooseGreetingRenderPatch = true;
    render = function patchedRender(data) {
      oldRender(data);
      const h1 = document.querySelector('.farm-hero h1');
      const name = data?.profile?.display_name || data?.profile?.login || data?.profile?.nick || '';
      if (h1 && name) {
        const hour = new Date().getHours();
        const hello = hour >= 5 && hour < 12 ? 'Доброе утро' : hour >= 12 && hour < 18 ? 'Добрый день' : hour >= 18 && hour < 23 ? 'Добрый вечер' : 'Доброй ночи';
        h1.textContent = `${hello}, ${name}`;
        h1.classList.add('hero-greeting-title');
      }
    };
  }


  window.refreshBuildingsIfVisible = function refreshBuildingsIfVisible(force) {
    const active = document.querySelector('.farm-tab-panel.active')?.getAttribute('data-farm-panel');
    if (!force && active !== 'buildings') return false;
    if (!state?.profile) return false;
    try {
      renderBuildings(state);
      return true;
    } catch (e) {
      console.warn('[BUILDINGS REFRESH]', e);
      return false;
    }
  };


  window.hasRenderedBuildings = function hasRenderedBuildings() {
    const el = document.getElementById('buildings');
    return !!(el && el.dataset.loaded === '1');
  };
})();

