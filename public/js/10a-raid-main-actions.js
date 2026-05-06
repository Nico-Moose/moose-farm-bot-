/* Extracted from 10-final-patches.js lines 1-175. Safe split, logic unchanged. */
/* Moose Farm frontend split module: финальные hotfix-патчи по рейдам/рынку/журналу
   Safe-refactor: extracted from public/app.js without logic changes. */
/* ==========================================================================
   RAID HISTORY + MAX FARM BUTTONS PATCH
   ========================================================================== */

function isValidNextUpgradeFinal(next) {
  return !!(next && typeof next === 'object' && next.level !== undefined && next.cost !== undefined);
}

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
    raidActionBtn.className = 'compact-action compact-action-raid danger-lite';
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

  const hasNextUpgrade = isValidNextUpgradeFinal(data.nextUpgrade);
  const isMaxFarm = !hasNextUpgrade;
  const upgrade1Btn = document.getElementById('upgrade1Btn');
  const upgrade10Btn = document.getElementById('upgrade10Btn');

  if (upgrade1Btn) {
    upgrade1Btn.classList.add('compact-action', 'compact-action-upgrade', 'compact-action-upgrade-one');
    upgrade1Btn.classList.toggle('farm-max-disabled', isMaxFarm);
    upgrade1Btn.disabled = isMaxFarm;
    upgrade1Btn.title = isMaxFarm ? 'Ферма уже максимального уровня' : '';
    upgrade1Btn.innerHTML = `⬆️ Ап +1<br><small id="upgrade1Text">${hasNextUpgrade ? formatNumber(data.nextUpgrade.cost) + '💰' + (data.nextUpgrade.parts ? ' / ' + formatNumber(data.nextUpgrade.parts) + '🔧' : '') : 'максимум'}</small>`;
  }

  if (upgrade10Btn) {
    upgrade10Btn.classList.add('compact-action', 'compact-action-upgrade', 'compact-action-upgrade-ten');
    upgrade10Btn.classList.toggle('farm-max-disabled', isMaxFarm);
    upgrade10Btn.disabled = isMaxFarm;
    upgrade10Btn.title = isMaxFarm ? 'Ферма уже максимального уровня' : '';
    const pack10 = hasNextUpgrade && typeof getFarmUpgradePack10 === 'function' ? getFarmUpgradePack10(data.profile || {}) : null;
    upgrade10Btn.innerHTML = `🚀 Улучшить ферму +10<br><small>${isMaxFarm ? 'максимум' : (pack10 && pack10.count ? `${formatNumber(pack10.cost)}💰${pack10.parts ? ' / ' + formatNumber(pack10.parts) + '🔧' : ''}` : 'до 10 уровней')}</small>`;
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


