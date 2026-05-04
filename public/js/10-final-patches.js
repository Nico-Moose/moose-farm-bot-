/* Moose Farm frontend split module: финальные hotfix-патчи по рейдам/рынку/журналу
   Safe-refactor: extracted from public/app.js without logic changes. */
/* ==========================================================================
   RAID HISTORY + MAX FARM BUTTONS PATCH
   ========================================================================== */

function latestRaidLogsFromState() {
  const p = state?.profile || {};
  const farm = p.farm || {};
  let logs = [];
  if (Array.isArray(farm.raidLogs)) logs = farm.raidLogs;
  if (!logs.length && Array.isArray(p.raidLogs)) logs = p.raidLogs;
  if (!logs.length && Array.isArray(state?.raidInfo?.logs)) logs = state.raidInfo.logs;
  return logs.slice().sort((a, b) => Number(b.timestamp || b.date || 0) - Number(a.timestamp || a.date || 0));
}

function raidSummaryTitle(log) {
  if (!log) return 'Рейд';
  if (log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered) return '🔫 Рейд отбит турелью';
  const me = String(state?.profile?.login || state?.user?.login || '').toLowerCase();
  const attacker = String(log.attacker || '').toLowerCase();
  return attacker === me ? '🏴‍☠️ Твой рейд' : '🛡 Рейд на тебя';
}

function openRaidLogModal(index = 0) {
  const logs = latestRaidLogsFromState();
  const log = logs[index];
  if (!log) {
    showMessage('📜 История рейдов пока пустая.');
    return;
  }

  const rows = typeof raidBreakdownRows === 'function'
    ? raidBreakdownRows(log)
    : [
      { label: '⚔️ Атакующий', value: log.attacker || '—' },
      { label: '🎯 Цель', value: log.target || '—' },
      { label: '💸 Монеты', value: `${formatNumber(log.stolen || 0)}💰` },
      { label: '💎 Бонусные', value: `${formatNumber(log.bonus_stolen || 0)}💎` },
      { label: '🛡 Щит', value: `${formatNumber(log.blocked || 0)}` },
      { label: '🚨 Множитель', value: `x${Number(log.punish_mult || 1).toFixed(2)}` }
    ];

  rows.unshift({ label: '⚔️ Атакующий', value: log.attacker || '—' });
  rows.unshift({ label: '🕒 Дата', value: log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : '—' });

  const list = logs.slice(0, 10).map((r, i) => `
    <button class="raid-history-mini ${i === index ? 'active' : ''}" data-raid-log-index="${i}" type="button">
      <b>${i + 1}. ${r.attacker || '—'} → ${r.target || '—'}</b>
      <span>${formatNumber(r.stolen || 0)}💰 ${Number(r.bonus_stolen || 0) ? '· ' + formatNumber(r.bonus_stolen || 0) + '💎' : ''}</span>
    </button>
  `).join('');

  const body = `
    <div class="raid-history-modal-layout">
      <div class="raid-history-sidebar">${list}</div>
      <div class="raid-history-detail">
        <div class="unified-report-list">
          ${rows.map((item) => `<div class="unified-report-row"><span>${item.label}</span><b>${item.value}</b></div>`).join('')}
        </div>
      </div>
    </div>
  `;

  unifiedModal(raidSummaryTitle(log), `${log.attacker || '—'} → ${log.target || '—'}`, body, { wide: true, kind: 'raid' });

  document.querySelectorAll('[data-raid-log-index]').forEach((btn) => {
    btn.addEventListener('click', () => openRaidLogModal(Number(btn.dataset.raidLogIndex || 0)));
  });
}

function ensureMainActionButtons(data) {
  const grid = document.querySelector('.action-grid-top');
  if (!grid) return;

  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) collectBtn.style.display = 'none';

  let raidWrap = document.getElementById('raidActionWrap');
  let raidActionBtn = document.getElementById('raidActionBtn');
  let raidHistoryBtn = document.getElementById('raidHistoryBtn');

  if (!raidWrap) {
    raidWrap = document.createElement('div');
    raidWrap.id = 'raidActionWrap';
    raidWrap.className = 'raid-action-wrap';
    grid.prepend(raidWrap);
  }

  if (!raidActionBtn) {
    raidActionBtn = document.createElement('button');
    raidActionBtn.id = 'raidActionBtn';
    raidActionBtn.className = 'compact-action danger-lite';
    raidWrap.appendChild(raidActionBtn);
    raidActionBtn.addEventListener('click', doRaid);
  }

  if (!raidHistoryBtn) {
    raidHistoryBtn = document.createElement('button');
    raidHistoryBtn.id = 'raidHistoryBtn';
    raidHistoryBtn.type = 'button';
    raidHistoryBtn.className = 'raid-history-small-btn';
    raidHistoryBtn.innerHTML = '📜 История рейдов';
    raidWrap.appendChild(raidHistoryBtn);
    raidHistoryBtn.addEventListener('click', () => openRaidLogModal(0));
  }

  const raid = data.raid || {};
  const raidReady = !raid.remainingMs;
  raidActionBtn.disabled = !raid.unlocked || !raidReady;
  raidActionBtn.innerHTML = raid.unlocked
    ? `🏴 Рейд<br><small>${raidReady ? 'готов к атаке' : 'кд ' + formatTime(raid.remainingMs)}</small>`
    : '🏴 Рейд<br><small>с 30 уровня</small>';

  const hasRaidHistory = latestRaidLogsFromState().length > 0;
  raidHistoryBtn.disabled = !hasRaidHistory;
  raidHistoryBtn.innerHTML = hasRaidHistory ? '📜 Последний рейд' : '📜 Истории нет';

  const isMaxFarm = !data.nextUpgrade;
  const upgrade1Btn = document.getElementById('upgrade1Btn');
  const upgrade10Btn = document.getElementById('upgrade10Btn');

  if (upgrade1Btn) {
    upgrade1Btn.classList.add('compact-action');
    upgrade1Btn.classList.toggle('farm-max-disabled', isMaxFarm);
    upgrade1Btn.disabled = isMaxFarm;
    upgrade1Btn.title = isMaxFarm ? 'Ферма уже максимального уровня' : '';
    upgrade1Btn.innerHTML = `⬆️ Улучшить ферму +1<br><small id="upgrade1Text">${data.nextUpgrade ? formatNumber(data.nextUpgrade.cost) + '💰' + (data.nextUpgrade.parts ? ' / ' + formatNumber(data.nextUpgrade.parts) + '🔧' : '') : 'максимум'}</small>`;
  }

  if (upgrade10Btn) {
    upgrade10Btn.classList.add('compact-action');
    upgrade10Btn.classList.toggle('farm-max-disabled', isMaxFarm);
    upgrade10Btn.disabled = isMaxFarm;
    upgrade10Btn.title = isMaxFarm ? 'Ферма уже максимального уровня' : '';
    upgrade10Btn.innerHTML = `🚀 Улучшить ферму +10<br><small>${isMaxFarm ? 'максимум' : 'до 10 уровней'}</small>`;
  }
}


/* LONG NICKNAME HOVER TITLE */
function installLongNicknameTitle() {
  const name = document.querySelector('.profile-name-final');
  if (name && !name.title) name.title = name.textContent.trim();
}
document.addEventListener('DOMContentLoaded', () => {
  installLongNicknameTitle();
  setInterval(installLongNicknameTitle, 1500);
});


/* LEGACY WIZEBOT IMPORT LABEL PATCH */
document.addEventListener('DOMContentLoaded', () => {
  const tune = () => {
    const btn = document.getElementById('admin-sync-from-wizebot');
    if (btn) btn.textContent = 'Импортировать старую !ферму в farm_v2';
  };
  tune();
  setTimeout(tune, 500);
  setTimeout(tune, 1500);
});


/* ADMIN LEGACY FARM IMPORT BUTTON LABEL */
document.addEventListener('DOMContentLoaded', () => {
  const tuneLegacyImportButton = () => {
    const btn = document.getElementById('admin-sync-from-wizebot');
    if (btn) btn.textContent = 'Перенести старую !ферму → farm_v2';
  };
  tuneLegacyImportButton();
  setTimeout(tuneLegacyImportButton, 500);
  setTimeout(tuneLegacyImportButton, 1500);
});


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
      if (activePanel === 'history') {
        loadHistory().catch((err) => console.warn('[HISTORY]', err));
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

    if (target === 'history') {
      loadHistory().catch((err) => console.warn('[HISTORY]', err));
    } else if (target === 'tops') {
      loadTops().catch((err) => console.warn('[TOPS]', err));
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
})();

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
      loadHistory().catch((err) => console.warn('[HISTORY]', err));
      return data;
    } catch (error) {
      document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
      console.error(error);
    }
  };

  if (typeof loadHistory === 'function') {
    const oldLoadHistoryNoStore = loadHistory;
    loadHistory = async function loadHistory() {
      try {
        return await oldLoadHistoryNoStore(bust('/api/history'));
      } catch (_) {
        // fallback: если старая функция не принимает url, повторим стандартный вызов
        return await oldLoadHistoryNoStore();
      }
    };
  }

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
    setTimeout(() => { loadMe(true).catch(() => {}); }, 180);
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


/* ==========================================================================
   PATCH: single factual history rows + hide technical sync rows
   ========================================================================== */
(function(){
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, (ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function fmt(value){ if (typeof stageFormat === 'function') return stageFormat(value); if (typeof formatNumber === 'function') return formatNumber(value); return String(value ?? 0); }
  function getPayload(e){ let p=e?.payload||e?.details||{}; if(typeof p==='string'){ try{p=JSON.parse(p);}catch(_){}} return p && typeof p==='object' ? p : {}; }
  function isTechSync(e){ const t=String(e?.type||'').toLowerCase(); return t.startsWith('sync_') || t.includes('sync_wizebot'); }
  function titleFor(e,p){ const t=String(e?.type||'').toLowerCase(); const s=String(p.source||p.action||'').toLowerCase();
    if(p.building||t.includes('building')) return '🏗 Здание улучшено';
    if(t.includes('raid_power')||s.includes('raid_power')) return '🏴 Рейд-сила улучшена';
    if(t.includes('turret')||s.includes('turret')) return '🔫 Турель улучшена';
    if(t.includes('protection')||s.includes('protection')||t.includes('defense')||s.includes('defense')) return '🛡 Защита улучшена';
    if(t==='upgrade'||s.includes('farm_upgrade')) return '🌾 Ферма улучшена';
    if(t.includes('case')) return '🎰 Кейс открыт';
    if(t.includes('market')) return '🏪 Рынок';
    if(t.includes('raid')) return '🏴 Рейд';
    if(t.includes('off')) return '🌙 Оффсбор';
    if(t.includes('gamus')) return '🎁 GAMUS';
    return '📌 Событие'; }
  function textFor(e,p){ const t=String(e?.type||'').toLowerCase(); const s=String(p.source||p.action||'').toLowerCase(); const money=p.totalCost??p.cost??p.coins??0; const parts=p.totalParts??p.parts??0; const up=p.upgraded??p.levels??p.count??1; const lvl=p.level??p.newLevel;
    if(p.building||t.includes('building')) return `Игрок улучшил здание: <b>${esc(p.building||p.key||'здание')}</b> +${fmt(up)} ур.${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('raid_power')||s.includes('raid_power')) return `Игрок улучшил рейд-силу${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('turret')||s.includes('turret')) return `Игрок улучшил турель${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('protection')||s.includes('protection')||t.includes('defense')||s.includes('defense')) return `Игрок улучшил защиту${lvl?` до ${fmt(lvl)} ур.`:` +${fmt(up)} ур.`}${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t==='upgrade'||s.includes('farm_upgrade')) return `Игрок улучшил ферму +${fmt(up)} ур.${money?` -${fmt(money)}💰`:''}${parts?` -${fmt(parts)}🔧`:''}`;
    if(t.includes('case')){ const val=p.prizeValue??p.finalValue??p.value??0; const icon=(p.prizeType||p.type)==='parts'?'🔧':'💎'; return `Игрок открыл кейс${val?` и получил <b>+${fmt(val)}${icon}</b>`:''}.`; }
    if(t.includes('market')) return `Операция на рынке${p.qty?`: ${fmt(p.qty)}🔧`:''}${money?` за ${fmt(money)}💎`:''}.`;
    return 'Действие выполнено.'; }
  renderEventsList = function renderEventsList(events){ const rows=(events||[]).filter((e)=>!isTechSync(e)); if(!rows.length) return '<p>Событий пока нет.</p>'; return rows.map((e)=>{ const p=getPayload(e); const login=e.login||p.login||state?.profile?.login||''; const date=e.created_at||e.timestamp||e.date||Date.now(); return `<div class="pretty-event-row event-row-clean history-human-row"><div class="event-title-line"><b>${titleFor(e,p)}</b>${login?`<span>@${esc(login)}</span>`:''}</div><small>${new Date(date).toLocaleString('ru-RU')}</small><p>${textFor(e,p)}</p></div>`; }).join(''); };
})();

/* ==========================================================================
   PATCH: restore readable raid modal/history + long case roulette only
   ========================================================================== */
(function(){
  function rrEscape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }
  function rrFmt(value) {
    if (typeof stageFormat === 'function') return stageFormat(value);
    if (typeof formatNumber === 'function') return formatNumber(value);
    return String(value ?? 0);
  }
  function rrIsTurret(log = {}) {
    return !!(log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered);
  }
  function rrCoinDelta(log = {}) {
    if (rrIsTurret(log)) {
      const penalty = Number(log.turret_refund || log.turret_penalty || log.penalty || log.stolen || 0);
      return -Math.abs(penalty);
    }
    return Number(log.stolen || 0);
  }
  function rrBonusDelta(log = {}) {
    if (rrIsTurret(log)) return 0;
    return Number(log.bonus_stolen || 0) + Number(log.turret_bonus || 0);
  }
  function rrSigned(value, icon) {
    const n = Number(value || 0);
    const sign = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}${rrFmt(Math.abs(n))}${icon}`;
  }
  function rrTitle(log = {}) {
    if (rrIsTurret(log)) return '🔫 Рейд отбит турелью';
    const me = String(state?.profile?.login || state?.user?.login || '').toLowerCase();
    const attacker = String(log.attacker || '').toLowerCase();
    return attacker === me ? '🏴‍☠️ Твой рейд' : '🛡 Рейд на тебя';
  }
  function rrMini(log = {}) {
    const parts = [rrSigned(rrCoinDelta(log), '💰')];
    const bonus = rrBonusDelta(log);
    if (bonus) parts.push(rrSigned(bonus, '💎'));
    if (rrIsTurret(log)) parts.push('🔫 турель');
    return parts.join(' · ');
  }
  function rrExtraRows(log = {}) {
    const rows = [];
    const base = Number(log.base_income || 0);
    const blocked = Number(log.blocked || 0);
    const afk = Number(log.punish_mult || 1);
    const turretChance = Number(log.turret_chance || log.turretChance || 0);
    const turretPenalty = Number(log.turret_refund || 0);
    const mainSpent = Number(log.money_from_main || log.main_spent || log.from_main || 0);
    const farmSpent = Number(log.money_from_farm || log.farm_spent || log.from_farm || 0);
    const debt = Number(log.debt_after || log.farm_debt || 0);
    const jammerLevel = Number(log.jammer_level || log.jammerLevel || 0);

    if (base) rows.push(['Базовый доход цели', `${rrFmt(base)}💰`]);
    if (blocked) rows.push(['Щит / защита заблокировали', `${rrFmt(blocked)}💰`]);
    rows.push(['AFK-множитель', `x${afk.toFixed(2)}`]);
    if (turretChance) rows.push(['Шанс турели', `${rrFmt(turretChance)}%`]);
    if (rrIsTurret(log)) rows.push(['Турель списала', `${rrFmt(turretPenalty || Math.abs(rrCoinDelta(log)))}💰`]);
    if (jammerLevel) rows.push(['Глушилка цели', `-${rrFmt(jammerLevel * 5)}% к шансу турели`]);
    if (mainSpent) rows.push(['Снято с обычной голды', `${rrFmt(mainSpent)}💰`]);
    if (farmSpent) rows.push(['Снято с фермы', `${rrFmt(farmSpent)}🌾`]);
    if (debt < 0) rows.push(['Долг после рейда', `${rrFmt(debt)}🌾`]);
    return rows;
  }
  function rrBody(log = {}, opts = {}) {
    const target = rrEscape(log.target || 'неизвестно');
    const attacker = rrEscape(log.attacker || 'игрок');
    const date = log.timestamp || log.date ? new Date(log.timestamp || log.date).toLocaleString('ru-RU') : '—';
    const cards = [
      ['🎯 Цель', target, ''],
      ['⚔️ Сила рейда', `${rrFmt(log.strength || 0)}%`, ''],
      ['💰 Итог монет', rrSigned(rrCoinDelta(log), '💰'), rrCoinDelta(log) >= 0 ? 'good' : 'bad'],
      ['💎 Бонусные', rrSigned(rrBonusDelta(log), '💎'), rrBonusDelta(log) > 0 ? 'good' : '']
    ];
    const rows = rrExtraRows(log);
    return `
      <div class="raid-primary-grid polished-raid-grid">
        ${cards.map(([label, value, mark]) => `<div class="raid-primary-card ${mark}"><span>${label}</span><b>${value}</b></div>`).join('')}
      </div>
      <div class="raid-secondary-grid polished-raid-meta">
        <div><span>🕒 Дата</span><b>${date}</b></div>
        <div><span>⚔️ Атакующий</span><b>${attacker}</b></div>
        <div><span>🎯 Цель</span><b>${target}</b></div>
        <div><span>📌 Итог</span><b>${rrIsTurret(log) ? 'рейд отбит турелью' : 'рейд успешен'}</b></div>
      </div>
      ${rows.length ? `
      <details class="raid-details-more polished-raid-details" ${opts.openDetails ? 'open' : ''}>
        <summary>Подробнее</summary>
        <div class="raid-rows-clean polished-raid-rows">
          ${rows.map(([label, value]) => `<div><span>${rrEscape(label)}</span><b>${value}</b></div>`).join('')}
        </div>
      </details>` : ''}
    `;
  }

  openRaidLogModal = function openRaidLogModal(index = 0) {
    const logs = latestRaidLogsFromState();
    const log = logs[index];
    if (!log) {
      showMessage('📜 История рейдов пока пустая.');
      return;
    }
    const list = logs.slice(0, 12).map((r, i) => `
      <button class="raid-history-mini ${i === index ? 'active' : ''}" data-raid-log-index="${i}" type="button">
        <b>${i + 1}. ${rrEscape(r.attacker || '—')} → ${rrEscape(r.target || '—')}</b>
        <span>${rrMini(r)}</span>
      </button>`).join('');
    const body = `
      <div class="raid-history-modal-layout">
        <div class="raid-history-sidebar">${list}</div>
        <div class="raid-history-detail">${rrBody(log, { openDetails: true })}</div>
      </div>`;
    unifiedModal(rrTitle(log), `${rrEscape(log.attacker || '—')} → ${rrEscape(log.target || '—')}`, body, { wide: true, kind: rrIsTurret(log) ? 'danger' : 'raid' });
    document.querySelectorAll('[data-raid-log-index]').forEach((btn) => {
      btn.addEventListener('click', () => openRaidLogModal(Number(btn.dataset.raidLogIndex || 0)));
    });
  };

  showRaidDetails = function showRaidDetails(log = {}) {
    unifiedModal(rrTitle(log), `${rrEscape(log.attacker || 'игрок')} → ${rrEscape(log.target || 'цель')}`, rrBody(log, { openDetails: true }), {
      kind: rrIsTurret(log) ? 'danger' : 'raid',
      wide: false
    });
  };

  doRaid = async function doRaid() {
    const data = await postJson('/api/farm/raid');
    if (!data.ok) {
      const labels = {
        farm_level_too_low: `рейды доступны с ${data.requiredLevel || 30} уровня фермы`,
        cooldown: `рейд доступен через ${formatTime(data.remainingMs || 0)}`,
        no_targets: 'нет подходящих целей для рейда'
      };
      showMessage(`❌ Рейд не выполнен: ${labels[data.error] || data.error}`);
      await loadMe();
      return;
    }
    const log = data.log || {};
    showRaidDetails(log);
    if (rrIsTurret(log)) {
      showMessage(`🔫 Турель ${log.target || 'цели'} отбила рейд. Списано ${rrFmt(Math.abs(rrCoinDelta(log)))}💰`);
    } else {
      showMessage(`🏴‍☠️ Рейд на ${log.target || 'цель'}: ${rrSigned(rrCoinDelta(log), '💰')}${rrBonusDelta(log) ? ' и ' + rrSigned(rrBonusDelta(log), '💎') : ''}`);
    }
    await loadMe();
    if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
  };

  const CASE_ROULETTE_DURATION = 12000;
  let caseSpinTimer = null;
  showCaseOverlay = function showCaseOverlay(prize) {
    const overlay = document.getElementById('caseOverlay');
    if (!overlay) return;

    const multiplier = Number(prize?.multiplier || 1) || 1;
    const winIndex = findCasePrizeIndex(prize);
    const winBase = CASE_PRIZES_UI_FULL[winIndex] || { type: prize?.type || 'coins', value: prize?.baseValue || casePrizeValue(prize) };
    const winValue = casePrizeValue(prize) || Math.floor(Number(winBase.value || 0) * multiplier);
    const items = [];
    const winnerPos = 38;
    const totalItems = 54;

    for (let i = 0; i < totalItems; i++) {
      const base = i === winnerPos ? winBase : CASE_PRIZES_UI_FULL[(winIndex + 3 + i * 5) % CASE_PRIZES_UI_FULL.length];
      const extra = i === winnerPos ? 'case-pending-win' : '';
      items.push(caseCellHtml(base, multiplier, extra, i === winnerPos ? winValue : null));
    }

    overlay.innerHTML = `
      <div class="case-overlay-card case-overlay-card-fixed case-overlay-card-longspin">
        <h2>🎰 Кейс открывается</h2>
        <div class="case-roulette case-roulette-fixed">
          <div class="case-pointer"></div>
          <div class="case-strip case-strip-fixed">${items.join('')}</div>
        </div>
        <div class="case-result case-result-pending">
          <div class="case-result-status">Рулетка крутится…</div>
          <small>Финальный приз появится после остановки рулетки</small>
        </div>
        <button id="caseOverlayClose">Закрыть</button>
      </div>`;

    overlay.classList.add('active');
    document.getElementById('caseOverlayClose')?.addEventListener('click', () => overlay.classList.remove('active'));

    const reveal = () => {
      const resultBox = overlay.querySelector('.case-result');
      const winCell = overlay.querySelector('.case-pending-win');
      if (resultBox) {
        resultBox.classList.remove('case-result-pending');
        resultBox.innerHTML = `Выигрыш: <b>${casePrizeText({ type: winBase.type, value: winValue })}</b><small>множитель x${multiplier.toFixed(2)} · базовый приз ${rrFmt(winBase.value)}${casePrizeIcon(winBase.type)}</small>`;
      }
      winCell?.classList.add('case-win');
    };

    requestAnimationFrame(() => {
      const roulette = overlay.querySelector('.case-roulette-fixed');
      const strip = overlay.querySelector('.case-strip-fixed');
      const winCell = overlay.querySelector('.case-pending-win');
      if (!roulette || !strip || !winCell) return;
      strip.style.transition = 'none';
      strip.style.transform = 'translateX(0px)';
      requestAnimationFrame(() => {
        const offset = winCell.offsetLeft + (winCell.offsetWidth / 2) - (roulette.clientWidth / 2);
        strip.style.transition = `transform ${CASE_ROULETTE_DURATION}ms cubic-bezier(.06,.82,.12,1)`;
        strip.style.transform = `translateX(-${Math.max(0, offset)}px)`;
        if (caseSpinTimer) clearTimeout(caseSpinTimer);
        caseSpinTimer = setTimeout(reveal, CASE_ROULETTE_DURATION + 100);
      });
    });
  };

  openCase = async function openCase() {
    const data = await postJson('/api/farm/case/open');
    if (!data.ok) {
      const labels = {
        farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
        cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
        not_enough_money: `не хватает монет: сейчас ${rrFmt(data.available || 0)} / нужно ${rrFmt(data.needed || 0)}`
      };
      showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
      await loadMe(true);
      return;
    }
    showCaseOverlay(data.prize);
    showMessage('🎰 Кейс открыт. Рулетка крутится...');
    await loadMe(true);
  };
})();

/* ==========================================================================
   PATCH: offcollect + clickable raid list + market history limit/toast only
   ========================================================================== */
(function(){
  function pNum(v){ return Number(v || 0); }
  function pFmt(v){ return typeof stageFormat === 'function' ? stageFormat(v) : (typeof formatNumber === 'function' ? formatNumber(v) : String(v || 0)); }
  function pEsc(v){ return String(v ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function pSigned(v, icon){ const n = Number(v || 0); return `${n > 0 ? '+' : n < 0 ? '-' : ''}${pFmt(Math.abs(n))}${icon}`; }
  function pTurret(log = {}){ return !!(log.killed_by_turret || log.raid_blocked_by_turret || log.turret_triggered); }
  function pRaidMoney(log = {}) {
    if (pTurret(log)) {
      const penalty = pNum(log.turret_refund || log.turret_penalty || log.penalty || log.stolen || 0);
      return -Math.abs(penalty);
    }
    return pNum(log.stolen || 0);
  }
  function pRaidBonus(log = {}) {
    if (pTurret(log)) return 0;
    return pNum(log.bonus_stolen || 0) + pNum(log.turret_bonus || 0);
  }

  // market history only 15 rows
  pushMarketHistory = function pushMarketHistory(item){
    stageMarketHistory.unshift({ ...item, ts: Date.now() });
    stageMarketHistory = stageMarketHistory.slice(0, 15);
    localStorage.setItem('stageMarketHistory', JSON.stringify(stageMarketHistory));
  };

  // Only toast for market buy/sell, no second popup
  marketTrade = async function marketTrade(action) {
    const qtyInput = document.getElementById('marketQty');
    const qty = Number(qtyInput?.value || 0);
    if (qty > 0) {
      lastMarketQty = qty;
      localStorage.setItem('mooseFarmLastMarketQty', String(qty));
    }
    const data = await postJson(`/api/farm/market/${action}`, { qty });
    if (!data.ok) {
      const labels = {
        invalid_quantity: 'укажи количество больше 0',
        quantity_too_large: `слишком большое число, максимум ${pFmt(data.maxQty || 0)}🔧`,
        not_enough_parts: `не хватает запчастей: ${pFmt(data.available || 0)}/${pFmt(data.needed || 0)}🔧`,
        not_enough_upgrade_balance: `не хватает 💎: ${pFmt(data.available || 0)} / ${pFmt(data.needed || 0)}`,
        market_stock_empty: 'общий склад пуст',
        not_enough_market_stock: 'на общем складе недостаточно 🔧'
      };
      showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
      await loadMe();
      return;
    }
    pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 });
    showActionToast(
      action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке',
      [
        action === 'buy' ? `Куплено: <b>${pFmt(data.qty)}🔧</b>` : `Продано: <b>${pFmt(data.qty)}🔧</b>`,
        action === 'buy' ? `Потрачено: <b>${pFmt(data.totalCost)}💎</b>` : `Получено: <b>${pFmt(data.totalCost)}💎</b>`,
        `Общий склад: <b>${pFmt(data.market?.stock ?? 0)}🔧</b>`
      ],
      { kind: 'market' }
    );
    await loadMe();
  };

  function buildingCoinsSummary(conf = {}, lvl = 0) {
    const coinPerLevel = pNum(conf.coinsPerHour || 0) + pNum(conf.coinsPerLevel || 0);
    return coinPerLevel > 0 ? coinPerLevel * pNum(lvl) : 0;
  }

  buildingCardSummary = function buildingCardSummary(key, conf, lvl) {
    key = String(key || '').toLowerCase();
    if (key === 'завод') {
      const parts = pNum(conf?.baseProduction || 0) + pNum(conf?.perLevel || 0) * Math.max(0, pNum(lvl) - 1);
      const coins = buildingCoinsSummary(conf, lvl);
      return `производит запчасти: ${pFmt(parts)}🔧/ч${coins ? ` · монеты: +${pFmt(coins)}/ч` : ''}`;
    }
    if (key === 'фабрика') {
      const boost = pNum(conf?.baseProduction || 0) + pNum(conf?.perLevel || 0) * Math.max(0, pNum(lvl) - 1);
      const coins = buildingCoinsSummary(conf, lvl);
      return `усиливает производство запчастей на ${pFmt(boost)}%${coins ? ` · монеты: +${pFmt(coins)}/ч` : ''}`;
    }
    return (typeof buildingLongBenefit === 'function' ? buildingLongBenefit(key, conf, lvl) : (conf?.description || 'улучшает ферму'));
  };

  renderExtras = function renderExtras(data) {
    const box = document.getElementById('extrasBox');
    if (!box) return;
    const p = data.profile || {};
    const cs = data.caseStatus || {};
    const gamus = data.gamus || {};
    const ranges = gamus.ranges || {};
    const lastCases = (cs.history || []).slice(0, 5).map((h) => `<li>${new Date(h.date).toLocaleString('ru-RU')} — ${prizeLabel(h)} за ${pFmt(h.cost)}💰</li>`).join('') || '<li>История пока пустая</li>';
    box.innerHTML = `
      <div class="combat-card">
        <h3>🎰 Кейс</h3>
        <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
        <p>Цена: <b>${pFmt(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
        <p>Призы: <b>${pFmt(ranges.minMoney || cs.minMoney || 0)}-${pFmt(ranges.maxMoney || cs.maxMoney || 0)}💎</b> / <b>${pFmt(ranges.minParts || cs.minParts || 0)}-${pFmt(ranges.maxParts || cs.maxParts || 0)}🔧</b></p>
        <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
        <button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button>
        <details><summary>Последние кейсы</summary><ol>${lastCases}</ol></details>
      </div>
      <div class="combat-card">
        <h3>🧠 GAMUS</h3>
        <p>Тир: <b>${pFmt(ranges.tierLevel || 0)}</b> | шахта: <b>${pFmt(ranges.mineLevel || 0)}</b></p>
        <p>Награда: <b>${pFmt(ranges.minMoney || 0)}-${pFmt(ranges.maxMoney || 0)}💎</b> / <b>${pFmt(ranges.minParts || 0)}-${pFmt(ranges.maxParts || 0)}🔧</b></p>
        <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
        <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
      </div>
      <div class="combat-card">
        <h3>🌙 Оффсбор</h3>
        <p>50% от общего дохода в час. Запчасти даёт только завод / 2.</p>
        <p>Баланс сейчас: <b>${pFmt(p.farm_balance || 0)}🌾</b> / <b>${pFmt(p.parts || 0)}🔧</b></p>
        <button id="offCollectBtn">🌙 Оффсбор</button>
      </div>
    `;
    document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
    document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
    document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
  };

  offCollect = async function offCollect() {
    if (state?.streamOnline || state?.profile?.stream_online) {
      showMessage('⛔ Во время стрима оффсбор недоступен.');
      return;
    }
    const data = await postJson('/api/farm/off-collect');
    if (!data.ok) {
      showMessage(data.error === 'cooldown' ? `⏳ Оффсбор через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
      await loadMe();
      return;
    }
    showActionToast('🌙 Оффсбор получен', [
      `Монеты: <b>+${pFmt(data.income || 0)}💰</b>`,
      `Запчасти: <b>+${pFmt(data.partsIncome || 0)}🔧</b>`,
      data.minutes ? `Период: <b>${pFmt(data.minutes)} мин</b>` : ''
    ].filter(Boolean), { kind: 'success' });
    await loadMe();
  };

  renderInfo = function renderInfo(data){
    const infoBox=document.getElementById('infoBox');
    const topsBox=document.getElementById('topsBox');
    if(!infoBox) return;
    const info=data.farmInfo||{};
    const raidInfo=data.raidInfo||{};
    const hourly=info.hourly||{};
    const balances=info.balances||{};
    const buildings=info.buildings||[];
    const raidLogs=(raidInfo.logs||[]).slice(0,10);
    const playerCards = [
      ['💰 Обычная голда', balances.twitch || 0, 'WizeBot / !money'],
      ['🌾 Ферма', balances.farm || 0, 'накопления фермы'],
      ['💎 Бонусные', balances.upgrade || 0, 'ап-баланс'],
      ['🔧 Запчасти', balances.parts || 0, 'детали'],
      ['📈 Доход/ч', hourly.total || 0, `пассив ${pFmt(hourly.passive||0)} · урожай ${pFmt((hourly.plants||0)+(hourly.animals||0))}`],
      ['🏴 Рейды 14д', raidInfo.twoWeeks?.count || 0, `${pFmt(raidInfo.twoWeeks?.stolen||0)}💰 · ${pFmt(raidInfo.twoWeeks?.bonus||0)}💎`],
    ];
    const buildingCells = buildings.length ? buildings.map((b)=>`<div class="info-building-cell"><b>${pEsc(b.config?.name || b.key)}</b><span>ур. ${pFmt(b.level || 0)}</span><small>${buildingCardSummary(b.key, b.config || {}, b.level || 0)}</small></div>`).join('') : '<div class="info-building-cell"><b>Построек нет</b><span>—</span><small>Построй здания во вкладке зданий.</small></div>';
    const raidRows = raidLogs.length ? raidLogs.map((r,i)=>`
      <button class="raid-log-row polished-raid-log-row" type="button" data-raid-log-index="${i}">
        <div class="raid-log-main">
          <b>${i+1}. ${new Date(r.timestamp||r.date||0).toLocaleString('ru-RU')} — ${pEsc(r.attacker || '—')} → ${pEsc(r.target || '—')}</b>
        </div>
        <div class="raid-log-meta">
          <span>${pSigned(pRaidMoney(r), '💰')}</span>
          <span>${pSigned(pRaidBonus(r), '💎')}</span>
          <span>${pTurret(r) ? '🔫 турель' : `${pFmt(r.strength || 0)}%`}</span>
        </div>
      </button>`).join('') : '<div class="raid-log-row">Рейдов пока нет</div>';
    infoBox.innerHTML=`
      <div class="analytics-grid">${playerCards.map(([label,value,hint])=>`<div class="analytics-card"><span>${label}</span><b>${pFmt(value)}</b><small>${hint}</small></div>`).join('')}</div>
      <div class="info-buildings-panel"><h3>🏗 Постройки</h3><div class="info-building-grid">${buildingCells}</div></div>
      <div class="raid-log-list beautiful-raid-log polished-raid-log-list"><div class="section-inline-title">Последние рейды</div>${raidRows}</div>
      <button id="refreshTopBtn">🏆 Обновить топы</button>`;
    document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
    document.querySelectorAll('[data-raid-log-index]').forEach((btn)=>btn.addEventListener('click', ()=>openRaidLogModal(Number(btn.dataset.raidLogIndex||0))));
    if(topsBox && !topsBox.dataset.loaded) loadTops();
  };
})();

/* ==========================================================================
   PATCH: market preset human qty parse only
   ========================================================================== */
(function(){
  function parseMarketHumanQty(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const match = raw.match(/^(\d+(?:\.\d+)?)(кк|kk|к|k|м|m)?$/i);
    if (!match) return Number(raw) || 0;
    const n = Number(match[1] || 0);
    const suffix = match[2] || '';
    if (suffix === 'к' || suffix === 'k') return Math.floor(n * 1000);
    if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') return Math.floor(n * 1000000);
    return Math.floor(n);
  }

  if (typeof window !== 'undefined') {
    window.parseMarketHumanQty = parseMarketHumanQty;
  }

  const oldMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (oldMarketTrade && !window.__mooseMarketHumanQtyPatch) {
    window.__mooseMarketHumanQtyPatch = true;
    marketTrade = async function marketTrade(action) {
      const qtyInput = document.getElementById('marketQty');
      const qty = parseMarketHumanQty(qtyInput?.value || 0);
      if (qtyInput) qtyInput.value = String(qty);
      return oldMarketTrade(action);
    };
  }

  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-market-preset]');
    if (!btn) return;
    const input = document.getElementById('marketQty');
    if (!input) return;
    const preset = String(btn.getAttribute('data-market-preset') || '');
    const map = {
      '1к': 1000,
      '1k': 1000,
      '10к': 10000,
      '10k': 10000,
      '100к': 100000,
      '100k': 100000,
      '1кк': 1000000,
      '1kk': 1000000
    };
    if (map[preset]) {
      input.value = String(map[preset]);
      try {
        lastMarketQty = map[preset];
        localStorage.setItem('mooseFarmLastMarketQty', String(map[preset]));
      } catch (_) {}
    }
  }, true);
})();

/* ==========================================================================
   PATCH: market human presets accumulate + minus row only
   ========================================================================== */
(function(){
  function mqToNumber(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
    if (!m) return Number(raw) || 0;
    const n = Number(m[1] || 0);
    const s = String(m[2] || '').toLowerCase();
    if (s === 'к' || s === 'k') return Math.round(n * 1_000);
    if (s === 'кк' || s === 'kk' || s === 'м' || s === 'm') return Math.round(n * 1_000_000);
    if (s === 'млрд' || s === 'b') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function mqHuman(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    if (n >= 1_000_000_000 && n % 1_000_000_000 === 0) return `${n / 1_000_000_000}млрд`;
    if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}кк`;
    if (n >= 1_000 && n % 1_000 === 0) return `${n / 1_000}к`;
    return String(n);
  }

  function mqSetInput(value) {
    const input = document.getElementById('marketQty');
    if (!input) return;
    const next = Math.max(0, Math.round(Number(value || 0)));
    input.dataset.numericValue = String(next);
    input.value = mqHuman(next);
    try {
      lastMarketQty = next;
      localStorage.setItem('mooseFarmLastMarketQty', String(next));
    } catch (_) {}
    if (typeof updateMarketCalc === 'function') {
      try { updateMarketCalc(); } catch (_) {}
    }
  }

  function mqGetInput() {
    const input = document.getElementById('marketQty');
    if (!input) return 0;
    const parsed = mqToNumber(input.dataset.numericValue || input.value || 0);
    const safe = Math.max(0, parsed);
    input.dataset.numericValue = String(safe);
    input.value = mqHuman(safe);
    return safe;
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketHumanPresets2) {
    window.__mooseMarketHumanPresets2 = true;
    renderMarket = function patchedRenderMarket(data) {
      oldRenderMarket(data);

      const box = document.getElementById('marketBox');
      const input = document.getElementById('marketQty');
      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      if (!box || !input) return;

      const firstRow = box.querySelector('.market-preset-row');
      if (firstRow && !box.querySelector('.market-preset-row-minus')) {
        const minusRow = document.createElement('div');
        minusRow.className = 'market-preset-row market-preset-row-minus';
        minusRow.innerHTML = `
          <button data-market-adjust="-1000">-1к</button>
          <button data-market-adjust="-10000">-10к</button>
          <button data-market-adjust="-100000">-100к</button>
          <button data-market-adjust="-1000000">-1кк</button>
        `;
        firstRow.insertAdjacentElement('afterend', minusRow);
      }

      const profile = data.profile || {};
      const market = data.market || {};
      const stock = Math.max(0, Number(market.stock || 0));
      const buyPrice = Math.max(1, Number(market.buyPrice || 20));
      const parts = Math.max(0, Number(profile.parts || 0));
      const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
      const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
      const maxSell = parts;

      mqSetInput(Number(lastMarketQty || input.dataset.numericValue || mqToNumber(input.value) || 0));

      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, mqToNumber(input.value)));
      });
      input.addEventListener('blur', () => mqSetInput(mqGetInput()));
      input.addEventListener('change', () => mqSetInput(mqGetInput()));

      box.querySelectorAll('[data-market-preset]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const preset = String(btn.getAttribute('data-market-preset') || '').toLowerCase();
          const current = mqGetInput();
          const addMap = {
            '1к': 1000, '1k': 1000, '1000': 1000,
            '10к': 10000, '10k': 10000, '10000': 10000,
            '100к': 100000, '100k': 100000, '100000': 100000,
            '1кк': 1000000, '1kk': 1000000, '1000000': 1000000
          };
          if (preset === 'buymax') return mqSetInput(maxBuy);
          if (preset === 'sellmax') return mqSetInput(maxSell);
          if (Object.prototype.hasOwnProperty.call(addMap, preset)) return mqSetInput(current + addMap[preset]);
        };
      });

      box.querySelectorAll('[data-market-adjust]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const delta = Number(btn.getAttribute('data-market-adjust') || 0);
          mqSetInput(Math.max(0, mqGetInput() + delta));
        };
      });

      if (buyBtn) {
        buyBtn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqHuman(qty);
          input.dataset.numericValue = String(qty);
          input.value = String(qty);
          try {
            await marketTrade('buy');
          } finally {
            input.dataset.numericValue = String(qty);
            input.value = pretty;
          }
        };
      }

      if (sellBtn) {
        sellBtn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqHuman(qty);
          input.dataset.numericValue = String(qty);
          input.value = String(qty);
          try {
            await marketTrade('sell');
          } finally {
            input.dataset.numericValue = String(qty);
            input.value = pretty;
          }
        };
      }
    };
  }
})();

/* ==========================================================================
   PATCH: market human display kk formatting only
   ========================================================================== */
(function(){
  function mqPretty(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    if (n >= 1_000_000_000) {
      const v = n / 1_000_000_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}млрд`;
    }
    if (n >= 1_000_000) {
      const v = n / 1_000_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}кк`;
    }
    if (n >= 1_000) {
      const v = n / 1_000;
      return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1')}к`;
    }
    return String(n);
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketPrettyFormatPatch) {
    window.__mooseMarketPrettyFormatPatch = true;
    renderMarket = function patchedRenderMarketPretty(data) {
      oldRenderMarket(data);
      const input = document.getElementById('marketQty');
      if (!input) return;

      const parse = (value) => {
        const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
        if (!raw) return 0;
        const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
        if (!m) return Number(raw) || 0;
        const num = Number(m[1] || 0);
        const suf = String(m[2] || '').toLowerCase();
        if (suf === 'к' || suf === 'k') return Math.round(num * 1_000);
        if (suf === 'кк' || suf === 'kk' || suf === 'м' || suf === 'm') return Math.round(num * 1_000_000);
        if (suf === 'млрд' || suf === 'b') return Math.round(num * 1_000_000_000);
        return Math.round(num);
      };

      const syncPretty = () => {
        const num = Math.max(0, parse(input.dataset.numericValue || input.value || 0));
        input.dataset.numericValue = String(num);
        input.value = mqPretty(num);
      };

      input.addEventListener('blur', syncPretty);
      input.addEventListener('change', syncPretty);
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, parse(input.value)));
      });

      document.querySelectorAll('[data-market-preset],[data-market-adjust]').forEach((btn) => {
        btn.addEventListener('click', () => {
          setTimeout(syncPretty, 0);
        });
      });

      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      [buyBtn, sellBtn].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
          setTimeout(syncPretty, 0);
        });
      });

      syncPretty();
    };
  }
})();

/* ==========================================================================
   PATCH: market input sync + equal preset sizes + clearer UX
   ========================================================================== */
(function(){
  function mqParse(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(кк|kk|к|k|млрд|b|м|m)?$/i);
    if (!m) return Number(raw) || 0;
    const n = Number(m[1] || 0);
    const s = String(m[2] || '').toLowerCase();
    if (s === 'к' || s === 'k') return Math.round(n * 1_000);
    if (s === 'кк' || s === 'kk' || s === 'м' || s === 'm') return Math.round(n * 1_000_000);
    if (s === 'млрд' || s === 'b') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function mqPretty(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    const fmt = (num) => String(num.toFixed(num < 10 ? 2 : num < 100 ? 1 : 0)).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0$/,'$1');
    if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000)}млрд`;
    if (n >= 1_000_000) return `${fmt(n / 1_000_000)}кк`;
    if (n >= 1_000) return `${fmt(n / 1_000)}к`;
    return String(n);
  }

  function mqGetInput() {
    const input = document.getElementById('marketQty');
    if (!input) return 0;
    const parsed = Math.max(0, mqParse(input.dataset.numericValue || input.value || 0));
    input.dataset.numericValue = String(parsed);
    return parsed;
  }

  function mqSetInput(value, opts = {}) {
    const input = document.getElementById('marketQty');
    if (!input) return;
    const n = Math.max(0, Math.round(Number(value || 0)));
    input.dataset.numericValue = String(n);
    input.value = opts.raw ? String(n) : mqPretty(n);
    try {
      lastMarketQty = n;
      localStorage.setItem('mooseFarmLastMarketQty', String(n));
    } catch (_) {}
    if (typeof updateMarketCalc === 'function') {
      try { updateMarketCalc(); } catch (_) {}
    }
    // Trigger any old listeners that recalc from input/change events
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function ensureCalcMatchesInput() {
    const n = mqGetInput();
    mqSetInput(n);
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket && !window.__mooseMarketSyncFix) {
    window.__mooseMarketSyncFix = true;
    renderMarket = function patchedRenderMarketSync(data) {
      oldRenderMarket(data);

      const box = document.getElementById('marketBox');
      const input = document.getElementById('marketQty');
      if (!box || !input) return;

      const topRow = box.querySelector('.market-preset-row');
      if (topRow) {
        topRow.classList.add('market-preset-grid');
        topRow.querySelectorAll('button').forEach((btn) => btn.classList.add('market-preset-btn-eq'));
      }
      const minusRow = box.querySelector('.market-preset-row-minus');
      if (minusRow) {
        minusRow.classList.add('market-preset-grid');
        minusRow.querySelectorAll('button').forEach((btn) => btn.classList.add('market-preset-btn-eq'));
      }

      const calc = document.getElementById('marketCalc');
      if (calc && !box.querySelector('.market-calc-hint')) {
        const hint = document.createElement('div');
        hint.className = 'market-calc-hint';
        hint.innerHTML = 'Поле можно менять кнопками <b>+</b>/<b>-</b> или вручную. Калькулятор всегда считает по текущему значению поля.';
        calc.insertAdjacentElement('beforebegin', hint);
      }

      mqSetInput(Number(lastMarketQty || input.dataset.numericValue || mqParse(input.value) || 0));

      const syncPretty = () => ensureCalcMatchesInput();
      input.setAttribute('inputmode', 'text');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('focus', () => {
        const n = mqGetInput();
        input.value = mqPretty(n);
      });
      input.addEventListener('blur', syncPretty);
      input.addEventListener('change', syncPretty);
      input.addEventListener('input', () => {
        input.dataset.numericValue = String(Math.max(0, mqParse(input.value)));
        if (typeof updateMarketCalc === 'function') {
          try { updateMarketCalc(); } catch (_) {}
        }
      });

      const addMap = {
        '1к': 1_000, '1k': 1_000, '1000': 1_000,
        '10к': 10_000, '10k': 10_000, '10000': 10_000,
        '100к': 100_000, '100k': 100_000, '100000': 100_000,
        '1кк': 1_000_000, '1kk': 1_000_000, '1000000': 1_000_000
      };

      box.querySelectorAll('[data-market-preset]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const preset = String(btn.getAttribute('data-market-preset') || '').toLowerCase();
          const current = mqGetInput();
          if (preset === 'buymax' || preset === 'макс купить') {
            const market = data.market || {};
            const profile = data.profile || {};
            const stock = Math.max(0, Number(market.stock || 0));
            const buyPrice = Math.max(1, Number(market.buyPrice || 20));
            const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
            return mqSetInput(Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice))));
          }
          if (preset === 'sellmax' || preset === 'макс продать') {
            return mqSetInput(Math.max(0, Number((data.profile || {}).parts || 0)));
          }
          if (Object.prototype.hasOwnProperty.call(addMap, preset)) {
            return mqSetInput(current + addMap[preset]);
          }
        };
      });

      box.querySelectorAll('[data-market-adjust]').forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const delta = Number(btn.getAttribute('data-market-adjust') || 0);
          mqSetInput(Math.max(0, mqGetInput() + delta));
        };
      });

      const buyBtn = document.getElementById('marketBuyBtn');
      const sellBtn = document.getElementById('marketSellBtn');
      [buyBtn, sellBtn].forEach((btn, idx) => {
        if (!btn) return;
        const action = idx === 0 ? 'buy' : 'sell';
        btn.onclick = async (e) => {
          e.preventDefault();
          const qty = mqGetInput();
          const pretty = mqPretty(qty);
          mqSetInput(qty, { raw: true });
          try {
            await marketTrade(action);
          } finally {
            mqSetInput(qty);
            const input = document.getElementById('marketQty');
            if (input) input.value = pretty;
          }
        };
      });

      ensureCalcMatchesInput();
    };
  }
})();


/* ==========================================================================
   PATCH: market single-request lock only
   ========================================================================== */
(function(){
  let marketRequestInFlight = false;

  const prevMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (prevMarketTrade && !window.__mooseMarketSingleRequestLock) {
    window.__mooseMarketSingleRequestLock = true;

    function setMarketButtonsBusy(isBusy) {
      ['marketBuyBtn', 'marketSellBtn'].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !!isBusy;
        btn.classList.toggle('is-busy', !!isBusy);
      });
    }

    marketTrade = async function lockedMarketTrade(action) {
      if (marketRequestInFlight) {
        return;
      }

      marketRequestInFlight = true;
      setMarketButtonsBusy(true);

      try {
        const result = await prevMarketTrade(action);
        return result;
      } catch (err) {
        const text = String(err && err.message ? err.message : err || '');
        if (!/action_in_progress/i.test(text)) {
          throw err;
        }
      } finally {
        marketRequestInFlight = false;
        setMarketButtonsBusy(false);
      }
    };
  }

  // If an older handler still produces this backend duplicate response,
  // hide the noisy user-facing message because the first request already succeeded.
  const prevShowMessage = typeof showMessage === 'function' ? showMessage : null;
  if (prevShowMessage && !window.__mooseHideActionInProgressMessage) {
    window.__mooseHideActionInProgressMessage = true;
    showMessage = function patchedShowMessage(message, ...rest) {
      if (/action_in_progress/i.test(String(message || ''))) {
        return;
      }
      return prevShowMessage(message, ...rest);
    };
  }
})();

/* ============================================================================
   SAFE PATCH 2026-05-04: market qty buttons exact big-number math v2
   - restores visible +/- buttons after the previous override
   - no 2kk UI limit
   - keeps exact integer value for 10kk/100kk/1b+ so small +/- steps work
   ========================================================================== */
(function(){
  if (window.__mooseMarketExactQtyButtonsV2) return;
  window.__mooseMarketExactQtyButtonsV2 = true;

  const MARKET_STEPS = [
    { label: '1к', value: 1000 },
    { label: '10к', value: 10000 },
    { label: '100к', value: 100000 },
    { label: '1кк', value: 1000000 }
  ];

  function mqParse(value) {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/,/g, '.');
    if (!raw) return 0;

    const m = raw.match(/^(-?\d+(?:\.\d+)?)(млрд|миллиард(?:а|ов)?|b|bn|кк|kk|м|m|к|k)?$/i);
    if (!m) return Math.max(0, Math.floor(Number(raw.replace(/[^0-9.-]/g, '')) || 0));

    const n = Number(m[1] || 0);
    const suffix = String(m[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'к' || suffix === 'k') mult = 1_000;
    else if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') mult = 1_000_000;
    else if (suffix === 'млрд' || suffix === 'b' || suffix === 'bn' || suffix.startsWith('миллиард')) mult = 1_000_000_000;

    return Math.max(0, Math.floor(n * mult));
  }

  function trimFixed(value, digits) {
    return Number(value.toFixed(digits)).toString();
  }

  function mqInputText(value) {
    const n = Math.max(0, Math.floor(Number(value || 0)));
    // В поле рынка всегда показываем точное число, без сокращений "1к/1кк/1млрд".
    // Так маленькие шаги +/- остаются понятными на больших суммах: 1 070 700, 12 001 000, 1 000 010 000.
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function mqPretty(value) {
    if (typeof stageFormat === 'function') {
      try { return stageFormat(value); } catch (_) {}
    }
    return mqInputText(value);
  }

  function mqGet(input) {
    if (!input) return 0;
    const stored = Number(input.dataset.exactQty || 0);
    const parsed = mqParse(input.value);
    const value = input.dataset.exactQty && input.value.trim() === input.dataset.prettyQty ? stored : parsed;
    const safe = Math.max(0, Math.floor(Number(value || 0)));
    input.dataset.exactQty = String(safe);
    input.dataset.numericValue = String(safe);
    return safe;
  }

  function mqSet(input, value) {
    if (!input) return;
    const safe = Math.max(0, Math.floor(Number(value || 0)));
    const pretty = mqInputText(safe);
    input.dataset.exactQty = String(safe);
    input.dataset.numericValue = String(safe);
    input.dataset.prettyQty = pretty;
    input.value = pretty;
    try {
      lastMarketQty = safe;
      localStorage.setItem('mooseFarmLastMarketQty', String(safe));
    } catch (_) {}
    mqCalc();
  }

  function mqStateData() {
    return state || window.state || {};
  }

  function mqCalc() {
    const input = document.getElementById('marketQty');
    const calc = document.getElementById('marketCalc');
    if (!input || !calc) return;

    const data = mqStateData();
    const market = data.market || {};
    const profile = data.profile || {};
    const q = mqGet(input);
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const stock = Math.max(0, Number(market.stock || 0));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    const canBuy = q > 0 && q <= maxBuy;
    const canSell = q > 0 && q <= parts;

    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.disabled = !canBuy;
    if (sellBtn) sellBtn.disabled = !canSell;

    calc.innerHTML = `Калькулятор: купить <b>${mqPretty(q)}🔧</b> = <b>${mqPretty(q * buyPrice)}💎</b> · продать <b>${mqPretty(q)}🔧</b> = <b>${mqPretty(q * sellPrice)}💎</b>`;
  }

  function mqMax(type) {
    const data = mqStateData();
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    if (type === 'buy') return Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    return Math.max(0, parts);
  }

  function mqInstallMarketButtons() {
    const box = document.getElementById('marketBox');
    const input = document.getElementById('marketQty');
    if (!box || !input) return;

    const actions = box.querySelector('.market-actions') || input.parentElement;
    if (!actions) return;

    box.querySelectorAll('.market-preset-row, .market-preset-row-minus, .market-preset-row-plus').forEach((row) => row.remove());

    const plusRow = document.createElement('div');
    plusRow.className = 'market-preset-row market-preset-row-fixed market-preset-grid market-preset-row-plus';
    plusRow.innerHTML = MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="${s.value}">+${s.label}</button>`).join('') +
      '<button type="button" class="market-preset-btn-eq" data-market-max="buy">макс купить</button>' +
      '<button type="button" class="market-preset-btn-eq" data-market-max="sell">макс продать</button>';

    const minusRow = document.createElement('div');
    minusRow.className = 'market-preset-row market-preset-row-minus market-preset-grid';
    minusRow.innerHTML = MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="-${s.value}">-${s.label}</button>`).join('') +
      '<button type="button" class="market-preset-btn-eq" data-market-reset="1">0</button>';

    actions.parentNode.insertBefore(plusRow, actions);
    actions.parentNode.insertBefore(minusRow, actions);

    const current = mqParse(input.dataset.exactQty || input.dataset.numericValue || input.value || lastMarketQty || 1000);
    mqSet(input, current || 1000);

    input.setAttribute('inputmode', 'text');
    input.setAttribute('autocomplete', 'off');
    input.oninput = () => {
      const exact = mqParse(input.value);
      input.dataset.exactQty = String(exact);
      input.dataset.numericValue = String(exact);
      input.dataset.prettyQty = input.value;
      try {
        lastMarketQty = exact;
        localStorage.setItem('mooseFarmLastMarketQty', String(exact));
      } catch (_) {}
      mqCalc();
    };
    input.onblur = () => mqSet(input, mqGet(input));
    input.onchange = () => mqSet(input, mqGet(input));

    box.querySelectorAll('[data-market-delta]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const delta = Number(btn.getAttribute('data-market-delta') || 0);
        mqSet(input, mqGet(input) + delta);
      };
    });

    box.querySelectorAll('[data-market-max]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        mqSet(input, mqMax(String(btn.getAttribute('data-market-max') || 'sell')));
      };
    });

    box.querySelectorAll('[data-market-reset]').forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        mqSet(input, 0);
      };
    });

    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.onclick = (e) => { e.preventDefault(); mqSet(input, mqGet(input)); marketTrade('buy'); };
    if (sellBtn) sellBtn.onclick = (e) => { e.preventDefault(); mqSet(input, mqGet(input)); marketTrade('sell'); };
  }

  const oldRenderMarket = typeof renderMarket === 'function' ? renderMarket : null;
  if (oldRenderMarket) {
    renderMarket = function patchedRenderMarketExactQtyButtonsV2(data) {
      oldRenderMarket(data);
      try { mqInstallMarketButtons(); } catch (e) { console.warn('[MARKET QTY BUTTONS V2]', e); }
    };
  }

  const oldMarketTrade = typeof marketTrade === 'function' ? marketTrade : null;
  if (oldMarketTrade) {
    marketTrade = async function patchedMarketTradeExactQtyV2(action) {
      const input = document.getElementById('marketQty');
      const qty = mqGet(input);
      if (input) input.value = String(qty);
      try {
        return await oldMarketTrade(action);
      } finally {
        if (input) mqSet(input, qty);
      }
    };
  }
})();

/* ============================================================================
   SAFE PATCH 2026-05-04: market exact full-number UI final
   - market uses the same "Текущие ресурсы" block as buildings
   - removes old compact balance/parts strip from market render
   - keeps qty, calculator, toast and local market history as exact spaced numbers
   - does not abbreviate market trade quantities to к/кк/млрд
   ========================================================================== */
(function(){
  if (window.__mooseMarketFullExactFinal) return;
  window.__mooseMarketFullExactFinal = true;

  const MARKET_STEPS = [
    { label: '1к', value: 1000 },
    { label: '10к', value: 10000 },
    { label: '100к', value: 100000 },
    { label: '1кк', value: 1000000 }
  ];

  function marketExact(n) {
    const value = Math.max(0, Math.floor(Number(n || 0)));
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function marketParse(value) {
    const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
    if (!raw) return 0;
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(млрд|миллиард(?:а|ов)?|b|bn|кк|kk|м|m|к|k)?$/i);
    if (!m) return Math.max(0, Math.floor(Number(raw.replace(/[^0-9.-]/g, '')) || 0));
    const n = Number(m[1] || 0);
    const suffix = String(m[2] || '').toLowerCase();
    let mult = 1;
    if (suffix === 'к' || suffix === 'k') mult = 1000;
    else if (suffix === 'кк' || suffix === 'kk' || suffix === 'м' || suffix === 'm') mult = 1000000;
    else if (suffix === 'млрд' || suffix === 'b' || suffix === 'bn' || suffix.startsWith('миллиард')) mult = 1000000000;
    return Math.max(0, Math.floor(n * mult));
  }

  function marketSetInput(input, value, recalc = true) {
    if (!input) return;
    const exact = Math.max(0, Math.floor(Number(value || 0)));
    input.dataset.exactQty = String(exact);
    input.dataset.numericValue = String(exact);
    input.dataset.prettyQty = marketExact(exact);
    input.value = marketExact(exact);
    try {
      lastMarketQty = exact;
      localStorage.setItem('mooseFarmLastMarketQty', String(exact));
    } catch (_) {}
    if (recalc) marketRecalc();
  }

  function marketGetInput(input) {
    if (!input) return 0;
    const exact = marketParse(input.value);
    input.dataset.exactQty = String(exact);
    input.dataset.numericValue = String(exact);
    return exact;
  }

  function marketData() {
    return state || window.state || {};
  }

  function marketMax(type) {
    const data = marketData();
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || profile.upgradeBalance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    return type === 'buy' ? Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice))) : parts;
  }

  function marketRecalc() {
    const input = document.getElementById('marketQty');
    const calc = document.getElementById('marketCalc');
    if (!input || !calc) return;
    const data = marketData();
    const market = data.market || {};
    const profile = data.profile || {};
    const q = marketGetInput(input);
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const stock = Math.max(0, Number(market.stock || 0));
    const upgradeBalance = Math.max(0, Number(profile.upgrade_balance || profile.upgradeBalance || 0));
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / buyPrice)));
    const buyBtn = document.getElementById('marketBuyBtn');
    const sellBtn = document.getElementById('marketSellBtn');
    if (buyBtn) buyBtn.disabled = !(q > 0 && q <= maxBuy);
    if (sellBtn) sellBtn.disabled = !(q > 0 && q <= parts);
    calc.innerHTML = `Калькулятор: купить <b>${marketExact(q)}🔧</b> = <b>${marketExact(q * buyPrice)}💎</b> · продать <b>${marketExact(q)}🔧</b> = <b>${marketExact(q * sellPrice)}💎</b>`;
  }

  function marketHistoryRows() {
    let rows = [];
    try { rows = Array.isArray(stageMarketHistory) ? stageMarketHistory : JSON.parse(localStorage.getItem('stageMarketHistory') || '[]'); } catch (_) { rows = []; }
    rows = rows.slice(0, 15);
    if (!rows.length) return '<p>Пока нет сделок в этой сессии.</p>';
    return rows.map((h) => `<div><span>${new Date(h.ts || Date.now()).toLocaleTimeString('ru-RU')}</span> ${h.action === 'buy' ? '🔵 куплено' : '🟢 продано'} <b>${marketExact(h.qty)}🔧</b> за <b>${marketExact(h.cost)}💎</b></div>`).join('');
  }

  renderMarket = function renderMarketExactFullNumbers(data) {
    const box = document.getElementById('marketBox');
    if (!box) return;
    const market = data.market || {};
    const profile = data.profile || {};
    const stock = Math.max(0, Number(market.stock || 0));
    const sellPrice = Math.max(1, Number(market.sellPrice || 10));
    const buyPrice = Math.max(1, Number(market.buyPrice || 20));
    const ordinary = typeof ordinaryCoins === 'function' ? ordinaryCoins(profile) : Number(profile.balance || profile.gold || 0);
    const farm = typeof farmCoins === 'function' ? farmCoins(profile) : Number(profile.farm_balance || profile.farmBalance || 0);
    const bonus = typeof bonusCoins === 'function' ? bonusCoins(profile) : Number(profile.upgrade_balance || profile.upgradeBalance || 0);
    const parts = Math.max(0, Number(profile.parts || 0));
    const maxBuy = Math.max(0, Math.min(stock, Math.floor(bonus / buyPrice)));
    const qty = Math.max(0, marketParse(localStorage.getItem('mooseFarmLastMarketQty') || lastMarketQty || 1000));

    box.innerHTML = `
      <div class="quick-status market-current-resources">
        <div><b>Текущие ресурсы</b></div>
        <div class="quick-status-grid">
          <span>💰 Голда: <b>${marketExact(ordinary)}</b></span>
          <span>🌾 Ферма: <b>${marketExact(farm)}</b></span>
          <span>💎 Бонусные: <b>${marketExact(bonus)}</b></span>
          <span>🔧 Запчасти: <b>${marketExact(parts)}</b></span>
        </div>
      </div>
      <div class="market-hero polished-market-hero stage-market-hero">
        <div class="market-stat"><span>📦 Общий склад</span><b>${formatNumber(stock)}🔧</b><small>один склад для всех игроков</small></div>
        <div class="market-stat"><span>🔵 Купить</span><b>${marketExact(buyPrice)}💎 / 1🔧</b><small>максимум: ${formatNumber(maxBuy)}🔧</small></div>
        <div class="market-stat"><span>🟢 Продать</span><b>${marketExact(sellPrice)}💎 / 1🔧</b><small>максимум: ${formatNumber(parts)}🔧</small></div>
      </div>
      <div class="market-preset-row market-preset-row-fixed market-preset-grid market-preset-row-plus">
        ${MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="${s.value}">+${s.label}</button>`).join('')}
        <button type="button" class="market-preset-btn-eq" data-market-max="buy">макс купить</button>
        <button type="button" class="market-preset-btn-eq" data-market-max="sell">макс продать</button>
      </div>
      <div class="market-preset-row market-preset-row-minus market-preset-grid">
        ${MARKET_STEPS.map((s) => `<button type="button" class="market-preset-btn-eq" data-market-delta="-${s.value}">-${s.label}</button>`).join('')}
        <button type="button" class="market-preset-btn-eq" data-market-reset="1">0</button>
      </div>
      <div class="market-actions pretty-actions polished-market-actions">
        <input id="marketQty" type="text" inputmode="text" autocomplete="off" value="${marketExact(qty)}" />
        <button id="marketBuyBtn">🔵 Купить</button>
        <button id="marketSellBtn">🟢 Продать</button>
      </div>
      <p class="market-hint">Поле можно менять кнопками +/- или вручную. Калькулятор всегда считает по текущему значению поля.</p>
      <div id="marketCalc" class="market-calc"></div>
      <div class="market-history"><b>История сделок</b>${marketHistoryRows()}</div>`;

    const input = document.getElementById('marketQty');
    marketSetInput(input, qty || 1000, false);
    input?.addEventListener('input', () => {
      const exact = marketParse(input.value);
      input.dataset.exactQty = String(exact);
      input.dataset.numericValue = String(exact);
      try { lastMarketQty = exact; localStorage.setItem('mooseFarmLastMarketQty', String(exact)); } catch (_) {}
      marketRecalc();
    });
    input?.addEventListener('blur', () => marketSetInput(input, marketGetInput(input)));
    input?.addEventListener('change', () => marketSetInput(input, marketGetInput(input)));
    box.querySelectorAll('[data-market-delta]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, marketGetInput(input) + Number(btn.getAttribute('data-market-delta') || 0));
    }));
    box.querySelectorAll('[data-market-max]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, marketMax(btn.getAttribute('data-market-max')));
    }));
    box.querySelectorAll('[data-market-reset]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.preventDefault();
      marketSetInput(input, 0);
    }));
    document.getElementById('marketBuyBtn')?.addEventListener('click', (e) => { e.preventDefault(); marketTrade('buy'); });
    document.getElementById('marketSellBtn')?.addEventListener('click', (e) => { e.preventDefault(); marketTrade('sell'); });
    marketRecalc();
  };

  marketTrade = async function marketTradeExactFullNumbers(action) {
    const input = document.getElementById('marketQty');
    const qty = marketGetInput(input);
    if (qty <= 0) {
      showMessage('❌ Рынок: укажи количество больше 0');
      return;
    }
    marketSetInput(input, qty, false);
    const data = await postJson(`/api/farm/market/${action}`, { qty });
    if (!data.ok) {
      const labels = {
        invalid_quantity: 'укажи количество больше 0',
        quantity_too_large: `слишком большое число, максимум ${marketExact(data.maxQty || 0)}🔧`,
        not_enough_parts: `не хватает запчастей: ${marketExact(data.available || 0)}/${marketExact(data.needed || 0)}🔧`,
        not_enough_upgrade_balance: `не хватает 💎: нужно ${marketExact(data.needed || 0)}, есть ${marketExact(data.available || 0)}`,
        market_stock_empty: 'общий склад пуст',
        not_enough_market_stock: 'на общем складе недостаточно 🔧'
      };
      showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
      marketSetInput(input, qty, false);
      await loadMe();
      setTimeout(() => marketSetInput(document.getElementById('marketQty'), qty), 0);
      return;
    }

    try { if (typeof pushMarketHistory === 'function') pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 }); } catch (_) {}
    showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [
      action === 'buy' ? `Куплено: <b>${marketExact(data.qty || qty)}🔧</b>` : `Продано: <b>${marketExact(data.qty || qty)}🔧</b>`,
      action === 'buy' ? `Потрачено: <b>${marketExact(data.totalCost || 0)}💎</b>` : `Получено: <b>${marketExact(data.totalCost || 0)}💎</b>`,
      `Общий склад: <b>${marketExact(data.market?.stock ?? 0)}🔧</b>`
    ], { kind: 'market' });
    marketSetInput(input, qty, false);
    await loadMe();
    setTimeout(() => marketSetInput(document.getElementById('marketQty'), qty), 0);
  };
})();


/* === ADMIN JOURNAL SAFE PATCH: 7 days, player filter, hide player card on journal tab === */
(function () {
  const escAdminJournal = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const adminJournalNumber = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.trunc(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  };

  function adminJournalEventName(type) {
    const map = {
      upgrade: '🌾 Ап фермы',
      building_buy: '🏗 Покупка здания',
      building_upgrade: '🏗 Ап здания',
      market_buy_parts: '🏪 Покупка на рынке',
      market_sell_parts: '🏪 Продажа на рынке',
      raid_power_upgrade: '⚔️ Ап рейд-силы',
      protection_upgrade: '🛡️ Ап защиты',
      turret_upgrade: '🔫 Ап турели',
      raid: '🏴 Рейд',
      case_open: '🎰 Кейс',
      gamus_claim: '🎯 GAMUS',
      off_collect: '🌙 Оффсбор',
      collect: '🧺 Сбор',
      license_buy: '📜 Лицензия',
      admin_farm_balance: '👑 Админ: баланс фермы',
      admin_upgrade_balance: '👑 Админ: бонусные',
      admin_parts: '👑 Админ: запчасти',
      admin_set_level: '👑 Админ: уровень',
      admin_set_protection: '👑 Админ: защита',
      admin_set_raid_power: '👑 Админ: рейд-сила',
      admin_transfer_farm: '👑 Админ: перенос фермы',
      admin_clear_debt: '👑 Админ: долги',
      admin_set_market_stock: '👑 Админ: склад рынка',
      admin_reset_cases: '👑 Админ: кейсы',
      admin_reset_gamus: '👑 Админ: GAMUS',
      admin_delete_turret: '👑 Админ: удаление турели',
      admin_restore_backup: '👑 Админ: backup',
      admin_set_roulette_tickets: '👑 Админ: билеты рулетки',
      admin_sync_from_wizebot: '👑 Админ: импорт из WizeBot',
      admin_push_to_wizebot: '👑 Админ: пуш в WizeBot',
      sync_wizebot_harvest: '🔄 WizeBot → сайт'
    };
    return map[type] || type || 'Событие';
  }

  function adminJournalText(event) {
    const p = event?.payload || {};
    const type = event?.type || '';
    const parts = [];

    if (type === 'raid') {
      const money = Number(p.stolen ?? p.money ?? p.farm_delta ?? p.amount ?? 0);
      const bonus = Number(p.bonus_stolen ?? p.bonus ?? p.upgrade_delta ?? 0);
      if (p.target) parts.push('цель: @' + escAdminJournal(p.target));
      if (Number.isFinite(money) && money) parts.push((money > 0 ? '+' : '') + adminJournalNumber(money) + '💰');
      if (Number.isFinite(bonus) && bonus) parts.push((bonus > 0 ? '+' : '') + adminJournalNumber(bonus) + '💎');
      if (p.raid_blocked_by_turret || p.killed_by_turret || p.turret_triggered) parts.push('турель отбила рейд');
      return parts.join(' · ') || 'Рейд записан.';
    }

    if (type === 'off_collect') {
      const money = Number(p.money ?? p.income ?? p.farmIncome ?? 0);
      const bonus = Number(p.bonus ?? p.upgradeIncome ?? 0);
      const details = Number(p.parts ?? p.partsIncome ?? 0);
      if (money) parts.push('получено: ' + adminJournalNumber(money) + '💰');
      if (bonus) parts.push('бонусные: ' + adminJournalNumber(bonus) + '💎');
      if (details) parts.push('запчасти: ' + adminJournalNumber(details) + '🔧');
      return parts.join(' · ') || 'Оффсбор выполнен.';
    }

    if (type === 'market_buy_parts' || type === 'market_sell_parts') {
      if (p.qty !== undefined) parts.push((type === 'market_buy_parts' ? 'куплено: ' : 'продано: ') + adminJournalNumber(p.qty) + '🔧');
      if (p.totalCost !== undefined || p.cost !== undefined) parts.push((type === 'market_buy_parts' ? 'потрачено: ' : 'получено: ') + adminJournalNumber(p.totalCost ?? p.cost) + '💎');
      return parts.join(' · ') || 'Сделка на рынке.';
    }

    if (p.amount !== undefined) parts.push('изменение: ' + adminJournalNumber(p.amount));
    if (p.next !== undefined) parts.push('итог: ' + adminJournalNumber(p.next));
    if (p.qty !== undefined) parts.push('кол-во: ' + adminJournalNumber(p.qty));
    if (p.cost !== undefined) parts.push('цена: ' + adminJournalNumber(p.cost));
    if (p.totalCost !== undefined) parts.push('цена: ' + adminJournalNumber(p.totalCost));
    if (p.money !== undefined) parts.push('монеты: ' + adminJournalNumber(p.money));
    if (p.bonus !== undefined) parts.push('бонусные: ' + adminJournalNumber(p.bonus));
    if (p.parts !== undefined) parts.push('запчасти: ' + adminJournalNumber(p.parts));
    if (p.building) parts.push('здание: ' + escAdminJournal(p.building));
    if (p.oldLogin && p.newLogin) parts.push(escAdminJournal(p.oldLogin) + ' → ' + escAdminJournal(p.newLogin));
    return parts.join(' · ') || 'Действие выполнено.';
  }

  window.renderAdminEvents = function renderAdminEventsJournalOnly(events) {
    const box = document.getElementById('admin-events-box');
    if (!box) return;
    const rows = Array.isArray(events) ? events : [];
    if (!rows.length) {
      box.innerHTML = '<p class="admin-journal-empty">За последние 7 дней событий не найдено.</p>';
      return;
    }
    box.innerHTML = '<div class="events-list admin-journal-list">' + rows.map((event) => {
      const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
      const login = event.login || event.display_name || event.payload?.login || '';
      return `<div class="pretty-event-row event-row-clean admin-journal-row">
        <div class="event-title-line"><b>${escAdminJournal(adminJournalEventName(event.type))}</b>${login ? `<span>@${escAdminJournal(login)}</span>` : ''}</div>
        <small>${escAdminJournal(date)}</small>
        <p>${adminJournalText(event)}</p>
      </div>`;
    }).join('') + '</div>';
  };

  window.loadAdminEvents = async function loadAdminEventsSevenDays() {
    const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase().replace(/^@/, '') || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    const params = new URLSearchParams({ limit: '150', days: '7' });
    if (login) params.set('login', login);
    if (type) params.set('type', type);
    const data = await adminGet('events?' + params.toString());
    window.renderAdminEvents(data.events || []);
  };

  function setAdminJournalOnlyMode() {
    const activeTab = document.querySelector('[data-admin-tab].active')?.getAttribute('data-admin-tab');
    const isJournal = activeTab === 'journal';
    const playerInfo = document.getElementById('admin-player-info');
    const playerSearch = document.querySelector('.admin-player-search');
    if (playerInfo) playerInfo.style.display = isJournal ? 'none' : '';
    if (playerSearch) playerSearch.style.display = isJournal ? 'none' : '';
    if (isJournal) {
      const mainLogin = document.getElementById('admin-login')?.value?.trim() || '';
      const journalLogin = document.getElementById('admin-events-login');
      if (journalLogin && !journalLogin.value && mainLogin) journalLogin.value = mainLogin;
      window.loadAdminEvents?.().catch((e) => setAdminStatus?.(e.message, true));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginInput = document.getElementById('admin-events-login');
    if (loginInput) loginInput.placeholder = 'ник игрока или пусто = все игроки за 7 дней';
    const loadBtn = document.getElementById('admin-load-events');
    if (loadBtn) loadBtn.textContent = 'Показать журнал за 7 дней';
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => btn.addEventListener('click', () => setTimeout(setAdminJournalOnlyMode, 0)));
    document.getElementById('admin-events-type')?.addEventListener('change', () => window.loadAdminEvents?.().catch((e) => setAdminStatus?.(e.message, true)));
    document.getElementById('admin-events-login')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.loadAdminEvents?.().catch((err) => setAdminStatus?.(err.message, true));
      }
    });
    setTimeout(setAdminJournalOnlyMode, 250);
  });
})();

/* ADMIN JOURNAL POLISH + PLAYER AUTOCOMPLETE SAFE PATCH 2026-05-04 */
(function () {
  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fullNum = (v) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return '0';
    return Math.trunc(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
  };
  const eventIcon = (type) => {
    if (type === 'raid') return '🏴';
    if (type === 'off_collect') return '🌙';
    if (type === 'market_buy_parts' || type === 'market_sell_parts') return '🏪';
    if (type === 'case_open') return '🎁';
    if (type === 'upgrade' || type === 'building_upgrade') return '⬆️';
    if (type === 'building_buy') return '🏗️';
    if (String(type || '').startsWith('admin_')) return '👑';
    return '📝';
  };
  const eventTone = (type) => {
    if (type === 'raid') return 'raid';
    if (type === 'off_collect') return 'off';
    if (type === 'market_buy_parts' || type === 'market_sell_parts') return 'market';
    if (String(type || '').startsWith('admin_')) return 'admin';
    return 'default';
  };
  const prettyPayload = (payload, type) => {
    payload = payload || {};
    const line = [];
    if (type === 'market_buy_parts') {
      if (payload.qty !== undefined) line.push('куплено: ' + fullNum(payload.qty) + ' 🔧');
      if (payload.totalCost !== undefined) line.push('потрачено: ' + fullNum(payload.totalCost) + ' 💎');
      return line.join(' · ');
    }
    if (type === 'market_sell_parts') {
      if (payload.qty !== undefined) line.push('продано: ' + fullNum(payload.qty) + ' 🔧');
      if (payload.totalCost !== undefined) line.push('получено: ' + fullNum(payload.totalCost) + ' 💎');
      return line.join(' · ');
    }
    if (type === 'off_collect') {
      if (payload.money !== undefined) line.push('получено монет: +' + fullNum(payload.money) + ' 💰');
      if (payload.parts !== undefined || payload.partsIncome !== undefined) line.push('запчасти: +' + fullNum(payload.parts ?? payload.partsIncome) + ' 🔧');
      if (payload.income !== undefined) line.push('доход: ' + fullNum(payload.income));
      return line.join(' · ');
    }
    if (type === 'raid') {
      const money = Number(payload.stolen ?? payload.money ?? 0);
      const bonus = Number(payload.bonus_stolen ?? payload.bonus ?? 0);
      if (payload.target) line.push('цель: @' + payload.target);
      if (money) line.push((money > 0 ? '+' : '') + fullNum(money) + ' 💰');
      if (bonus) line.push((bonus > 0 ? '+' : '') + fullNum(bonus) + ' 💎');
      if (payload.blocked) line.push('блок: ' + fullNum(payload.blocked) + ' 🛡️');
      if (payload.turret_refund) line.push('турель: -' + fullNum(payload.turret_refund) + ' 💰');
      return line.join(' · ') || 'рейд без изменения ресурсов';
    }
    try { return typeof describePayload === 'function' ? describePayload(payload, type) : JSON.stringify(payload).slice(0, 180); }
    catch (_) { return JSON.stringify(payload).slice(0, 180); }
  };

  window.renderAdminEvents = function renderAdminEventsPolished(events) {
    const box = document.getElementById('admin-events-box');
    const summary = document.getElementById('admin-events-summary');
    if (!box) return;
    const list = Array.isArray(events) ? events : [];
    const login = document.getElementById('admin-events-login')?.value?.trim() || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    if (summary) {
      const target = login ? '@' + login.replace(/^@/, '') : 'все игроки';
      const label = type && typeof eventTypeLabel === 'function' ? eventTypeLabel(type) : 'все типы';
      summary.innerHTML = `<b>Показано:</b> ${list.length} · <b>Игрок:</b> ${esc(target)} · <b>Тип:</b> ${esc(label)} · <b>Период:</b> 7 дней`;
    }
    if (!list.length) {
      box.innerHTML = '<div class="admin-events-empty">За последние 7 дней событий не найдено.</div>';
      return;
    }
    box.innerHTML = list.map((event) => {
      const date = new Date(Number(event.created_at || Date.now())).toLocaleString('ru-RU');
      const loginText = event.login || event.display_name || event.twitch_id || 'unknown';
      const title = typeof eventTypeLabel === 'function' ? eventTypeLabel(event.type) : event.type;
      return `<div class="admin-event-card admin-event-${eventTone(event.type)}">
        <div class="admin-event-head">
          <div><b>${eventIcon(event.type)} ${esc(title)}</b><small>${esc(date)}</small></div>
          <span>@${esc(loginText)}</span>
        </div>
        <div class="admin-event-body">${esc(prettyPayload(event.payload, event.type))}</div>
      </div>`;
    }).join('');
  };

  window.loadAdminEvents = async function loadAdminEventsPolished() {
    const login = document.getElementById('admin-events-login')?.value?.trim()?.toLowerCase().replace(/^@/, '') || '';
    const type = document.getElementById('admin-events-type')?.value || '';
    const params = new URLSearchParams({ limit: '300', days: '7' });
    if (login) params.set('login', login);
    if (type) params.set('type', type);
    const data = await adminGet('events?' + params.toString());
    window.renderAdminEvents(data.events || []);
  };

  function setupAdminJournalAutocomplete() {
    const input = document.getElementById('admin-events-login');
    const box = document.getElementById('admin-events-suggestions');
    if (!input || !box || input.dataset.journalAutocompleteReady === '1') return;
    input.dataset.journalAutocompleteReady = '1';
    let timer = null;
    const update = async () => {
      const prefix = input.value.trim().toLowerCase().replace(/^@/, '');
      const players = await fetchAdminPlayers(prefix);
      if (!players.length) {
        box.innerHTML = '';
        box.classList.add('hidden');
        return;
      }
      box.innerHTML = players.map((p) => {
        const login = String(p.login || '').toLowerCase();
        const display = p.display_name || p.login || login;
        return `<button type="button" data-admin-journal-suggest="${esc(login)}"><b>${esc(login)}</b><small>${esc(display)} · ур. ${fullNum(p.level || 0)}</small></button>`;
      }).join('');
      box.classList.remove('hidden');
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => update().catch(() => {}), 120);
    });
    input.addEventListener('focus', () => update().catch(() => {}));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.loadAdminEvents().catch((e) => setAdminStatus(e.message, true));
      }
    });
    box.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-admin-journal-suggest]');
      if (!btn) return;
      input.value = btn.getAttribute('data-admin-journal-suggest');
      box.classList.add('hidden');
      window.loadAdminEvents().catch((e) => setAdminStatus(e.message, true));
    });
    document.addEventListener('click', (event) => {
      if (event.target === input || box.contains(event.target)) return;
      box.classList.add('hidden');
    });
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(setupAdminJournalAutocomplete, 800));
})();
