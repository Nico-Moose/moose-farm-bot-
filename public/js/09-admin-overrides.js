/* Moose Farm frontend split module: накопленные overrides админ-панели
   Safe-refactor: extracted from public/app.js without logic changes. */
// Soft admin backup preview UI: injects into existing admin modal when available.
function installBackupPreviewPanel() {
  const adminPanel = document.getElementById('admin-panel') || document.querySelector('.admin-panel') || document.querySelector('[data-admin-panel]');
  if (!adminPanel || document.getElementById('backupPreviewPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'backupPreviewPanel';
  panel.className = 'backup-preview-panel';
  panel.innerHTML = `
    <h3>🧯 Backup / Restore</h3>
    <p>Preview перед восстановлением. Можно выбрать блок: всё, балансы, прогресс, ферма, здания, рейды, кейсы.</p>
    <div class="backup-controls">
      <button id="backupLoadBtn">Показать backup’и игрока</button>
      <select id="backupBlockSelect">
        <option value="all">Всё</option>
        <option value="balances">Балансы</option>
        <option value="progression">Прогресс</option>
        <option value="farm">Ферма</option>
        <option value="buildings">Здания</option>
        <option value="raids">Рейды</option>
        <option value="cases">Кейсы</option>
      </select>
    </div>
    <div id="backupListBox" class="backup-list-box"></div>`;
  adminPanel.appendChild(panel);
  document.getElementById('backupLoadBtn')?.addEventListener('click', async () => {
    const login = (document.getElementById('admin-login')?.value || '').trim().toLowerCase();
    if (!login) return setAdminStatus?.('Укажи игрока', true);
    const data = await adminGet(`backups?login=${encodeURIComponent(login)}`);
    const list = data.backups || [];
    const box = document.getElementById('backupListBox');
    box.innerHTML = list.length ? list.map((b, i)=>`
      <div class="backup-item">
        <b>#${i+1} · ${new Date(b.createdAt || Date.now()).toLocaleString('ru-RU')}</b>
        <small>${b.reason || 'backup'} · уровень ${b.level ?? '—'} · 🌾${stageFormat(b.farm_balance||0)} · 💎${stageFormat(b.upgrade_balance||0)} · 🔧${stageFormat(b.parts||0)}</small>
        <button data-backup-restore="${i}">Preview / restore</button>
      </div>`).join('') : '<p>Backup’ов нет.</p>';
    box.querySelectorAll('[data-backup-restore]').forEach(btn=>btn.addEventListener('click', async()=>{
      const index = Number(btn.dataset.backupRestore||0);
      const block = document.getElementById('backupBlockSelect')?.value || 'all';
      const backup = list[index] || {};
      unifiedModal('🧯 Preview восстановления', `Игрок ${login} · блок ${block}`, `<pre class="backup-preview-json">${JSON.stringify(backup, null, 2).slice(0, 6000)}</pre><button id="confirmBackupRestore">Восстановить этот backup</button>`, {wide:true});
      document.getElementById('confirmBackupRestore')?.addEventListener('click', async()=>{
        await adminPost('restore-backup-index', { login, index, block });
        closeUnifiedModal();
        setAdminStatus?.('Backup восстановлен');
        await refreshAdminPlayer?.();
      });
    }));
  });
}

setInterval(installBackupPreviewPanel, 1500);
document.addEventListener('DOMContentLoaded', () => setTimeout(installBackupPreviewPanel, 1000));

function renderEventsList(events) {
  return (events || []).map((e) => `
    <div class="pretty-event-row">
      <b>${normalizedEventTitle(e)}</b>
      <small>${e.created_at || e.timestamp ? new Date(e.created_at || e.timestamp).toLocaleString('ru-RU') : ''}</small>
      <p>${formatEventDetails(e)}</p>
    </div>`).join('');
}


/* ==========================================================================
   NEXT POLISH PATCH: final unified raid/offcollect reports, journal cleanup,
   richer tops and backup blocks.
   ========================================================================== */

function raidBreakdownRows(log = {}) {
  const moneyFromMain = Number(log.money_from_main || log.main_spent || log.from_main || 0);
  const moneyFromFarm = Number(log.money_from_farm || log.farm_spent || log.from_farm || 0);
  const debt = Number(log.debt_after || log.farm_debt || 0);
  const bonus = Number(log.bonus_stolen || 0) + Number(log.turret_bonus || 0);
  const rows = [
    { label: '🎯 Цель', value: String(log.target || '—') },
    { label: '⚔️ Сила атаки', value: `${stageFormat(log.strength || 0)}%` },
    { label: '📈 Базовый доход цели', value: `${stageFormat(log.base_income || 0)}💰` },
    { label: '🛡 Щит заблокировал', value: `${stageFormat(log.blocked || 0)}💰` },
    { label: '💸 Итог монет', value: `${stageFormat(log.stolen || 0)}💰` },
    { label: '💎 Бонусные', value: `${stageFormat(bonus)}💎` },
    { label: '🚨 AFK-множитель', value: `x${Number(log.punish_mult || 1).toFixed(2)}` }
  ];
  if (moneyFromMain) rows.push({ label: '💰 Снято с !money', value: `${stageFormat(moneyFromMain)}💰` });
  if (moneyFromFarm) rows.push({ label: '🌾 Снято с фермы', value: `${stageFormat(moneyFromFarm)}🌾` });
  if (debt < 0) rows.push({ label: '📉 Долг после рейда', value: `${stageFormat(debt)}🌾` });
  if (log.turret_refund) rows.push({ label: '🔫 Турель списала', value: `${stageFormat(log.turret_refund)}💰` });
  if (log.turret_chance || log.turretChance) rows.push({ label: '🎯 Шанс турели', value: `${stageFormat(log.turret_chance || log.turretChance)}%` });
  if (log.jammer_level || log.jammerLevel) rows.push({ label: '📡 Глушилка', value: `-${stageFormat((log.jammer_level || log.jammerLevel) * 5)}%` });
  return rows;
}

async function doRaid() {
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
  const turretBlocked = !!(log.raid_blocked_by_turret || log.killed_by_turret || log.turret_triggered);
  const title = turretBlocked ? `🔫 Рейд отбит турелью` : `🏴‍☠️ Рейд успешен`;
  const subtitle = `${state?.profile?.display_name || state?.profile?.login || 'Игрок'} → ${log.target || 'цель'}`;
  renderActionReport(title, subtitle, raidBreakdownRows(log), { kind: turretBlocked ? 'danger' : 'success', autoCloseMs: 14000 });
  showMessage(turretBlocked ? `🔫 Турель ${log.target} отбила рейд. Списано ${stageFormat(log.turret_refund || 0)}💰` : `🏴‍☠️ Рейд на ${log.target}: +${stageFormat(log.stolen || 0)}💰`);
  await loadMe();
  if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
}

async function offCollect() {
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
  renderUnifiedReward('🌙 Оффсбор получен', '50% от фермы + 50% запчастей завода', [
    { label: '🌾 Ферма', value: `+${stageFormat(data.income || 0)}`, hint: 'зачислено в farm_balance' },
    { label: '🔧 Завод', value: `+${stageFormat(data.partsIncome || 0)}`, hint: 'зачислено в parts' },
    { label: '⏱ Период', value: `${stageFormat(data.minutes || 0)} мин` },
    { label: '📌 Правило', value: 'без бонусных и зданий', hint: 'только ферма и завод / 2' }
  ], { kind: 'success', wide: true });
  await loadMe();
}

function cleanPayloadText(payload) {
  let obj = payload;
  if (typeof payload === 'string') {
    try { obj = JSON.parse(payload); } catch (_) { obj = payload; }
  }
  if (!obj || typeof obj !== 'object') return String(obj || '').replace(/[{}"]/g, '').slice(0, 260);

  const ignore = new Set(['keys','farm_json','farm_v2','farm','payload','configs','configs_json','turret_json']);
  const labels = {
    login: 'игрок', ok: 'статус', action: 'действие', qty: 'кол-во',
    amount: 'сумма', totalCost: 'стоимость', totalParts: 'запчасти',
    building: 'здание', level: 'уровень', oldValue: 'было', newValue: 'стало',
    target: 'цель', attacker: 'атакующий', stolen: 'украдено',
    bonus_stolen: 'бонусные', cost: 'цена', parts: 'детали',
    farm_balance: 'ферма', upgrade_balance: 'бонусные', twitch_balance: 'голда'
  };
  const parts = [];
  Object.keys(obj).forEach((k) => {
    if (ignore.has(k)) return;
    const v = obj[k];
    if (v && typeof v === 'object') return;
    parts.push(`${labels[k] || k}: <b>${String(v)}</b>`);
  });
  return parts.slice(0, 10).join(' · ') || 'событие записано';
}

function prettyEventName(type) {
  type = String(type || '').toLowerCase();
  if (type.includes('market')) return '🏪 Рынок';
  if (type.includes('case')) return '🎰 Кейс';
  if (type.includes('raid')) return '🏴‍☠️ Рейд';
  if (type.includes('turret')) return '🔫 Турель';
  if (type.includes('building')) return '🏗 Здание';
  if (type.includes('license')) return '📜 Лицензия';
  if (type.includes('gamus')) return '🎁 GAMUS';
  if (type.includes('off')) return '🌙 Оффсбор';
  if (type.includes('restore')) return '🧯 Restore';
  if (type.includes('backup')) return '💾 Backup';
  if (type.includes('admin')) return '👑 Админ';
  if (type.includes('sync')) return '🔄 Синхронизация';
  return '📌 Событие';
}

function renderEventsList(events) {
  return (events || []).map((e) => {
    const payload = e.payload || e.details || {};
    const date = e.created_at || e.timestamp || Date.now();
    const login = e.login || payload.login || '';
    return `
      <div class="pretty-event-row event-row-clean">
        <div class="event-title-line"><b>${prettyEventName(e.type)}</b>${login ? `<span>@${login}</span>` : ''}</div>
        <small>${new Date(date).toLocaleString('ru-RU')}</small>
        <p>${cleanPayloadText(payload)}</p>
      </div>`;
  }).join('');
}

function renderTopMiniList(title, arr, valueFn, hintFn) {
  return `<div class="top-card top-card-polished"><b>${title}</b><ol>${arr.length ? arr.map((p, i) => `
    <li><span><em>#${i+1}</em> ${p.nick || p.login || '—'}</span><strong>${valueFn(p)}</strong><small>${hintFn ? hintFn(p) : ''}</small></li>`).join('') : '<li>нет данных</li>'}</ol></div>`;
}

async function loadTops() {
  const topsBox = document.getElementById('topsBox');
  if (!topsBox) return;
  try {
    const res = await fetch('/api/farm/top?days=14');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'top_failed');
    topsBox.dataset.loaded = '1';
    const players = (data.playerTop || []).slice();
    const raids = (data.raidTop || []).slice(0, 10);
    const by = (fn) => players.slice().sort((a,b)=>Number(fn(b)||0)-Number(fn(a)||0)).slice(0,10);

    topsBox.innerHTML = `
      <h3>🏆 Топы и аналитика</h3>
      <div class="analytics-hero-grid">
        ${renderTopMiniList('💰 Богатейшие', by(ordinaryCoins), p=>`${stageFormat(ordinaryCoins(p))}💰`, p=>`ур. ${p.level} · 🌾${stageFormat(farmCoins(p))}`)}
        ${renderTopMiniList('🌾 Ферма', by(farmCoins), p=>`${stageFormat(farmCoins(p))}🌾`, p=>`💎${stageFormat(bonusCoins(p))}`)}
        ${renderTopMiniList('💎 Бонусные', by(bonusCoins), p=>`${stageFormat(bonusCoins(p))}💎`, p=>`🔧${stageFormat(p.parts || 0)}`)}
        ${renderTopMiniList('🔧 Запчасти', by(p=>p.parts), p=>`${stageFormat(p.parts||0)}🔧`, p=>`ур. ${p.level}`)}
        ${renderTopMiniList(`🏴 Рейдеры ${data.days}д`, raids, r=>`${stageFormat(r.money)}💰 / ${stageFormat(r.bonus)}💎`, r=>`${r.attacks}⚔ · ${r.defends}🛡`)}
        ${renderTopMiniList('⚡ Активные', by(p=>p.last_collect_at), p=>p.nick || p.login, p=>p.last_collect_at ? new Date(Number(p.last_collect_at)).toLocaleString('ru-RU') : 'нет сбора')}
      </div>`;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}

function improveAdminEditorVisuals() {
  const modal = document.querySelector('.admin-modal, #adminModal, .admin-panel-modal');
  if (!modal || modal.dataset.polishedAdmin === '1') return;
  modal.dataset.polishedAdmin = '1';
  modal.classList.add('admin-modal-polished');
  const tabs = modal.querySelectorAll('button');
  tabs.forEach((btn) => {
    if (!btn.title) btn.title = 'Админ-действие. Перед опасными изменениями создаётся backup.';
  });
}
setInterval(improveAdminEditorVisuals, 1500);
document.addEventListener('DOMContentLoaded', () => setTimeout(improveAdminEditorVisuals, 1000));


