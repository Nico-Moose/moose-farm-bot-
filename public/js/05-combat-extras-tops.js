/* Moose Farm frontend split module: рейды, кейсы, GAMUS, оффсбор, топ/инфо
   Safe-refactor: extracted from public/app.js without logic changes. */
function renderCombat(data) {
  const box = document.getElementById('combatBox');
  if (!box) return;

  const p = data.profile || {};
  const raidPower = data.raidUpgrades?.raidPower || {};
  const protection = data.raidUpgrades?.protection || {};
  const turret = data.turret || {};
  const raid = data.raid || {};
  const raidReady = !raid.remainingMs;

  const raidPowerNeed = Number(raidPower.nextCost || 0);
  const protectionNeed = Number(protection.nextCost || 0);
  const turretNeed = turret.nextUpgrade || null;

  box.innerHTML = `
    <div class="combat-card">
      <h3>⚔️ Рейд-сила</h3>
      <p>Уровень: <b>${formatNumber(raidPower.level || 0)}/${formatNumber(raidPower.maxLevel || 200)}</b></p>
      <p>Цена следующего: <b>${raidPowerNeed ? formatNumber(raidPowerNeed) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b>${raidPowerNeed && (p.upgrade_balance || 0) < raidPowerNeed ? ` ❌ не хватает ${formatNumber(raidPowerNeed - (p.upgrade_balance || 0))}💎` : ' ✅'}</p>
      <div class="building-actions">
        <button data-raid-power="1" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +1</button>
        <button data-raid-power="10" ${!raidPower.unlocked ? 'disabled' : ''}>⬆️ +10</button>
      </div>
      ${!raidPower.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>

    <div class="combat-card">
      <h3>🛡 Защита</h3>
      <p>Уровень: <b>${formatNumber(protection.level || 0)}/${formatNumber(protection.maxLevel || 120)}</b> (${Number(protection.percent || 0).toFixed(1)}%)</p>
      <p>Цена следующего: <b>${protectionNeed ? formatNumber(protectionNeed) + '💎' : 'максимум'}</b></p>
      <p class="resource-line">Ап-баланс: <b>${formatNumber(p.upgrade_balance || 0)}💎</b>${protectionNeed && (p.upgrade_balance || 0) < protectionNeed ? ` ❌ не хватает ${formatNumber(protectionNeed - (p.upgrade_balance || 0))}💎` : ' ✅'}</p>
      <div class="building-actions">
        <button data-protection="1" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +1</button>
        <button data-protection="10" ${!protection.unlocked ? 'disabled' : ''}>⬆️ +10</button>
      </div>
      ${!protection.unlocked ? '<p class="shortage">Доступно с 120 уровня фермы</p>' : ''}
    </div>

    <div class="combat-card">
      <h3>🔫 Турель</h3>
      <p>Уровень: <b>${formatNumber(turret.level || 0)}/${formatNumber(turret.maxLevel || 20)}</b> | шанс: <b>${formatNumber(turret.chance || 0)}%</b></p>
      ${turretNeed ? `<p>Следующий: <b>${formatNumber(turretNeed.chance)}%</b> за <b>${formatNumber(turretNeed.cost)}💰</b> / <b>${formatNumber(turretNeed.parts)}🔧</b></p>` : '<p>✅ Максимальный уровень</p>'}
      ${turretNeed ? `<p class="resource-line">У тебя: <b>${formatNumber(currentCoins(p))}💰</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>` : ''}
      ${turretNeed ? '<button id="turretUpgradeBtn">🔫 Улучшить турель</button>' : ''}
    </div>

    <div class="combat-card">
      <h3>🏴 Рейд</h3>
      <p>Доступ: <b>${raid.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Кулдаун: <b>${raidReady ? 'готово ✅' : formatTime(raid.remainingMs)}</b></p>
      <button id="raidBtn" ${!raid.unlocked || !raidReady ? 'disabled' : ''}>🏴 Совершить рейд</button>
      <p class="muted">Цель выбирается автоматически. Чаще попадаются богатые фермы.</p>
    </div>
  `;

  document.querySelectorAll('[data-raid-power]').forEach((btn) => btn.addEventListener('click', () => upgradeRaidPower(Number(btn.dataset.raidPower || 1))));
  document.querySelectorAll('[data-protection]').forEach((btn) => btn.addEventListener('click', () => upgradeProtection(Number(btn.dataset.protection || 1))));
  document.getElementById('turretUpgradeBtn')?.addEventListener('click', upgradeTurret);
  document.getElementById('raidBtn')?.addEventListener('click', doRaid);
}

async function upgradeRaidPower(count) {
  const data = await postJson('/api/farm/raid-power/upgrade', { count });
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `доступно с ${data.requiredLevel || 120} уровня фермы`,
      max_level: 'рейд-сила уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Рейд-сила не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`⚔️ Рейд-сила +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
  await loadMe();
}

async function upgradeProtection(count) {
  const data = await postJson('/api/farm/protection/upgrade', { count });
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `доступно с ${data.requiredLevel || 120} уровня фермы`,
      max_level: 'защита уже максимальная',
      not_enough_upgrade_balance: `не хватает 💎: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Защита не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🛡 Защита +${data.upgraded}. Новый уровень: ${data.level}. Потрачено ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
  await loadMe();
}

async function upgradeTurret() {
  const data = await postJson('/api/farm/turret/upgrade');
  if (!data.ok) {
    const labels = {
      max_level: 'турель уже максимальная',
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`,
      not_enough_parts: `не хватает запчастей: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Турель не улучшена: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🔫 Турель улучшена до ${data.level} ур. Потрачено ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
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
  if (turretBlocked) {
    showMessage(`🔫 Рейд на ${log.target} отбит турелью: цель не потеряла монеты | с атакующего списано ${formatNumber(log.turret_refund || 0)}💰 | сила ${formatNumber(log.strength)}% x${log.punish_mult}`);
  } else {
    showMessage(`🏴 Рейд на ${log.target}: украдено ${formatNumber(log.stolen)}💰 | сила ${formatNumber(log.strength)}% x${log.punish_mult} | блок ${formatNumber(log.blocked)}🛡`);
  }
  showRaidDetails(log);
  await loadMe();
  if (document.querySelector('[data-farm-panel="info"]')?.classList.contains('active')) {
    await loadTops();
  }
}

function prizeLabel(prize) {
  if (!prize) return '';
  const icon = prize.type === 'parts' ? '🔧' : '💎';
  return formatNumber(prize.value) + icon + ' x' + Number(prize.multiplier || 1).toFixed(2);
}

function renderExtras(data) {
  const box = document.getElementById('extrasBox');
  if (!box) return;
  const p = data.profile || {};
  const cs = data.caseStatus || {};
  const gamus = data.gamus || {};
  const ranges = gamus.ranges || {};

  const lastCases = (cs.history || []).slice(0, 5).map((h) => `<li>${new Date(h.date).toLocaleString('ru-RU')} — ${prizeLabel(h)} за ${formatNumber(h.cost)}💰</li>`).join('') || '<li>История пока пустая</li>';

  box.innerHTML = `
    <div class="combat-card">
      <h3>🎰 Кейс</h3>
      <p>Доступ: <b>${cs.unlocked ? 'да' : 'с 30 уровня фермы'}</b></p>
      <p>Цена: <b>${formatNumber(cs.cost || 0)}💰</b> | множитель: <b>x${Number(cs.finalMultiplier || 1).toFixed(2)}</b></p>
      <p>Кулдаун: <b>${cs.remainingMs ? formatTime(cs.remainingMs) : 'готово ✅'}</b></p>
      <button id="openCaseBtn" ${!cs.unlocked || cs.remainingMs ? 'disabled' : ''}>🎰 Открыть кейс</button>
      <details><summary>Последние кейсы</summary><ol>${lastCases}</ol></details>
    </div>

    <div class="combat-card">
      <h3>🧠 GAMUS</h3>
      <p>Тир: <b>${formatNumber(ranges.tierLevel || 0)}</b> | шахта: <b>${formatNumber(ranges.mineLevel || 0)}</b></p>
      <p>Награда: <b>${formatNumber(ranges.minMoney || 0)}-${formatNumber(ranges.maxMoney || 0)}💎</b> / <b>${formatNumber(ranges.minParts || 0)}-${formatNumber(ranges.maxParts || 0)}🔧</b></p>
      <p>Ресет: <b>06:00 МСК</b> | ${gamus.available ? 'готово ✅' : 'через ' + formatTime(gamus.remainingMs || 0)}</p>
      <button id="gamusBtn" ${!gamus.available ? 'disabled' : ''}>🎁 Забрать GAMUS</button>
    </div>

    <div class="combat-card">
      <h3>🌙 Оффсбор</h3>
      <p>Урезанный сбор 50% как в WizeBot.</p>
      <p>Баланс сейчас: <b>${formatNumber(p.farm_balance || 0)}🌾</b> / <b>${formatNumber(p.parts || 0)}🔧</b></p>
      <button id="offCollectBtn">🌙 Оффсбор</button>
    </div>
  `;

  document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
  document.getElementById('gamusBtn')?.addEventListener('click', claimGamus);
  document.getElementById('offCollectBtn')?.addEventListener('click', offCollect);
}

function renderInfo(data) {
  const infoBox = document.getElementById('infoBox');
  const topsBox = document.getElementById('topsBox');
  if (!infoBox) return;
  const info = data.farmInfo || {};
  const raidInfo = data.raidInfo || {};
  const hourly = info.hourly || {};
  const balances = info.balances || {};
  const buildings = info.buildings || [];
  const raidLogs = (raidInfo.logs || []).slice(0, 8);

  infoBox.innerHTML = `
    <div class="info-grid">
      <div class="info-metric"><span>💰 Обычные</span><b>${formatNumber(balances.twitch || 0)}</b><small>монеты Twitch / !мани</small></div>
      <div class="info-metric"><span>🌾 Ферма</span><b>${formatNumber(balances.farm || 0)}</b><small>вирт. монеты фермы</small></div>
      <div class="info-metric"><span>💎 Ап-баланс</span><b>${formatNumber(balances.upgrade || 0)}</b><small>бонусные</small></div>
      <div class="info-metric"><span>🔧 Запчасти</span><b>${formatNumber(balances.parts || 0)}</b><small>детали</small></div>
      <div class="info-metric"><span>📈 Доход/ч</span><b>${formatNumber(hourly.total || 0)}</b><small>пассив ${formatNumber(hourly.passive || 0)} · урожай ${formatNumber((hourly.plants || 0) + (hourly.animals || 0))} · здания ${formatNumber(hourly.buildingCoins || 0)}</small></div>
      <div class="info-metric"><span>🏗 Здания</span><b>${buildings.length}</b><small>${buildings.length ? buildings.map((b) => `${b.config?.name || b.key}: ${b.level}`).join(' · ') : 'нет'}</small></div>
      <div class="info-metric"><span>🏴 Рейды за 14д</span><b>${formatNumber(raidInfo.twoWeeks?.count || 0)} шт.</b><small>${formatNumber(raidInfo.twoWeeks?.stolen || 0)}💰 · ${formatNumber(raidInfo.twoWeeks?.bonus || 0)}💎</small></div>
    </div>
    <details open><summary>Последние рейды</summary>
      <ol>${raidLogs.length ? raidLogs.map((r) => `<li>${new Date(r.timestamp).toLocaleString('ru-RU')} — ${r.attacker} → ${r.target}: ${formatNumber(r.stolen)}💰, ${formatNumber(r.bonus_stolen || 0)}💎</li>`).join('') : '<li>Рейдов пока нет</li>'}</ol>
    </details>
    <button id="refreshTopBtn">🏆 Обновить топы</button>
  `;
  document.getElementById('refreshTopBtn')?.addEventListener('click', loadTops);
  if (topsBox && !topsBox.dataset.loaded) loadTops();
}

async function openCase() {
  const data = await postJson('/api/farm/case/open');
  if (!data.ok) {
    const labels = {
      farm_level_too_low: `кейс доступен с ${data.requiredLevel || 30} уровня`,
      cooldown: `кейс будет доступен через ${formatTime(data.remainingMs || 0)}`,
      not_enough_money: `не хватает монет: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`
    };
    showMessage(`❌ Кейс не открыт: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  showCaseOverlay(data.prize);
  showMessage(`🎰 Кейс: выигрыш ${prizeLabel(data.prize)}. Цена ${formatNumber(data.cost)}💰`);
  await loadMe();
}

async function claimGamus() {
  const data = await postJson('/api/farm/gamus/claim');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ GAMUS будет доступен через ${formatTime(data.remainingMs || 0)} (06:00 МСК)` : `❌ GAMUS: ${data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🎁 GAMUS: +${formatNumber(data.money)}💎 и +${formatNumber(data.parts)}🔧 (тир ${data.tierLevel})`);
  await loadMe();
}

async function offCollect() {
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}💰${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
  await loadMe();
}

async function loadTops() {
  const topsBox = document.getElementById('topsBox');
  if (!topsBox) return;
  try {
    const res = await fetch('/api/farm/top?days=14');
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'top_failed');
    topsBox.dataset.loaded = '1';
    const raids = (data.raidTop || []).slice(0, 10);
    const players = (data.playerTop || []).slice(0, 10);
    topsBox.innerHTML = `
      <h3>🏆 Топы</h3>
      <div class="tops-grid pretty-tops">
        <div class="top-card"><b>🏴 Топ рейдов за ${data.days}д</b><ol>${raids.length ? raids.map((r) => `<li><span>${r.nick}</span><strong>${formatNumber(r.money)}💰 / ${formatNumber(r.bonus)}💎</strong><em>${r.attacks}⚔ · ${r.defends}🛡</em></li>`).join('') : '<li>нет рейдов</li>'}</ol></div>
        <div class="top-card"><b>💰 Топ игроков</b><ol>${players.length ? players.map((p) => `<li><span>${p.nick}</span><strong>💰${formatNumber(ordinaryCoins(p))} / 🌾${formatNumber(farmCoins(p))} / 💎${formatNumber(bonusCoins(p))}</strong><em>ур. ${p.level} · 🔧${formatNumber(p.parts)}</em></li>`).join('') : '<li>нет игроков</li>'}</ol></div>
      </div>
    `;
  } catch (error) {
    topsBox.textContent = 'Не удалось загрузить топы';
  }
}
