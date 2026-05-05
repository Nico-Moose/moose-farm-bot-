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
  showPrettyModal({
    title: '🎉 Кейс открыт',
    subtitle: 'Приз уже посчитан с множителем',
    body: `<div class="result-highlight"><div>🎁 Выигрыш</div><b>${prizeLabel(data.prize)}</b></div><div class="result-mini-grid"><div><span>💰 Цена</span><b>${formatNumber(data.cost || 0)}💰</b></div><div><span>🧮 Множитель</span><b>x${Number(data.prize?.multiplier || 1).toFixed(2)}</b></div><div><span>📦 Тип</span><b>${data.prize?.type === 'parts' ? 'Запчасти' : 'Бонусные'}</b></div></div>`,
    autoCloseMs: 9000,
    kind: 'success'
  });
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
  showPrettyModal({
    title: '🎁 GAMUS получен',
    subtitle: `Тир ${data.tierLevel || 0}`,
    body: `<div class="result-mini-grid"><div><span>💎 Монеты</span><b>+${formatNumber(data.money || 0)}</b></div><div><span>🔧 Дала шахта</span><b>+${formatNumber(data.parts || 0)}</b></div><div><span>📈 Тир</span><b>${formatNumber(data.tierLevel || 0)}</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🎁 GAMUS: +${formatNumber(data.money)}💎 и +${formatNumber(data.parts)}🔧 (тир ${data.tierLevel})`);
  await loadMe();
}

async function offCollect() {
  if (state?.streamOnline || state?.profile?.stream_online) {
    showMessage('⛔ Во время стрима оффсбор недоступен.');
    return;
  }
  const data = await postJson('/api/farm/off-collect');
  if (!data.ok) {
    showMessage(data.error === 'cooldown' ? `⏳ Оффсбор будет доступен через ${formatTime(data.remainingMs || 0)}` : `❌ Оффсбор: ${data.error}`);
    await loadMe();
    return;
  }
  showPrettyModal({
    title: '🌙 Оффсбор получен',
    subtitle: 'Красивый отчёт по сбору',
    body: `<div class="result-mini-grid"><div><span>🌾 Монеты фермы</span><b>+${formatNumber(data.income || 0)}</b></div><div><span>🔧 Запчасти</span><b>+${formatNumber(data.partsIncome || 0)}</b></div><div><span>⏱ За период</span><b>${formatNumber(data.minutes || 0)} мин</b></div></div>`,
    autoCloseMs: 8000,
    kind: 'success'
  });
  showMessage(`🌙 Оффсбор: +${formatNumber(data.income)}💰${data.partsIncome ? ` / +${formatNumber(data.partsIncome)}🔧` : ''}`);
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
  const body = `
    <div class="result-highlight"><div>${turretBlocked ? '🔫 Турель отбила атаку' : '🏴 Атака успешна'}</div><b>${log.target || 'неизвестно'}</b></div>
    <div class="result-mini-grid">
      <div><span>🎯 Цель</span><b>${log.target || '—'}</b></div>
      <div><span>⚔️ Сила</span><b>${formatNumber(log.strength || 0)}%</b></div>
      <div><span>📈 Доход цели</span><b>${formatNumber(log.base_income || 0)}💰</b></div>
      <div><span>💸 Украдено</span><b>${formatNumber(log.stolen || 0)}💰</b></div>
      <div><span>💎 Бонусные</span><b>${formatNumber((log.bonus_stolen || 0) + (log.turret_bonus || 0))}💎</b></div>
      <div><span>🛡 Блок</span><b>${formatNumber(log.blocked || 0)}</b></div>
      ${log.turret_refund ? `<div><span>🔫 Турель списала</span><b>${formatNumber(log.turret_refund)}💰</b></div>` : ''}
      <div><span>🚨 Множитель</span><b>x${formatNumber(log.punish_mult || 1)}</b></div>
    </div>
  `;
  showPrettyModal({ title: turretBlocked ? `🔫 Рейд на ${log.target}: турель` : `🏴 Рейд на ${log.target}`, subtitle: 'Подробный итог атаки', body, autoCloseMs: 12000, wide: true, kind: turretBlocked ? 'danger' : 'success' });
  showRaidDetails(log);
  showMessage(turretBlocked ? `🔫 Рейд на ${log.target} отбит турелью: цель не потеряла монеты | с атакующего списано ${formatNumber(log.turret_refund || 0)}💰` : `🏴 Рейд на ${log.target}: украдено ${formatNumber(log.stolen)}💰`);
  await loadMe();
  if (document.querySelector('[data-farm-panel="tops"]')?.classList.contains('active')) await loadTops();
}

async function marketTrade(action) {
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
      quantity_too_large: `слишком большое число, максимум ${formatNumber(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: ${formatNumber(data.available || 0)}/${formatNumber(data.needed || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎 ап-баланса: сейчас ${formatNumber(data.available || 0)} / нужно ${formatNumber(data.needed || 0)}`,
      market_stock_empty: 'склад рынка пуст',
      not_enough_market_stock: 'на складе рынка недостаточно запчастей'
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }
  const modalBody = action === 'buy'
    ? `<div class="result-mini-grid"><div><span>🔧 Куплено</span><b>${formatNumber(data.qty)}🔧</b></div><div><span>💎 Потрачено</span><b>${formatNumber(data.totalCost)}💎</b></div><div><span>📦 Склад</span><b>${formatNumber(data.market?.stock ?? 0)}🔧</b></div></div>`
    : `<div class="result-mini-grid"><div><span>🔧 Продано</span><b>${formatNumber(data.qty)}🔧</b></div><div><span>💎 Получено</span><b>${formatNumber(data.totalCost)}💎</b></div><div><span>📦 Склад</span><b>${formatNumber(data.market?.stock ?? 0)}🔧</b></div></div>`;
  showPrettyModal({ title: action === 'buy' ? '🏪 Покупка завершена' : '🏪 Продажа завершена', body: modalBody, autoCloseMs: 7000, kind: 'success' });
  showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [action === 'buy' ? `Куплено: <b>${formatNumber(data.qty)}🔧</b>` : `Продано: <b>${formatNumber(data.qty)}🔧</b>`, action === 'buy' ? `Потрачено: <b>${formatNumber(data.totalCost)}💎</b>` : `Получено: <b>${formatNumber(data.totalCost)}💎</b>`], { kind: 'market' });
  showMessage(action === 'buy' ? `🔵 Куплено ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎` : `🟢 Продано ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎`);
  await loadMe();
}

async function upgradeBuilding(key, count) {
  if (count >= 10) {
    const p = state?.profile || {};
    const conf = p.configs?.buildings?.[key] || {};
    const lvl = Number(p.farm?.buildings?.[key] || 0);
    let sumCoins = 0; let sumParts = 0;
    for (let step = 1; step <= count; step++) {
      const nextLevel = lvl + step;
      sumCoins += Number(conf.baseCost || 0) + Math.max(0, nextLevel - 1) * Number(conf.costIncreasePerLevel || 0);
      sumParts += Number(conf.partsBase || 0) + Math.max(0, nextLevel - 1) * Number(conf.partsPerLevel || 0);
    }
    const ok = await confirmFarmModal({ title: `⬆️ Ап ${conf.name || key} +${count}`, body: `<div class="result-mini-grid"><div><span>💰 Будет списано</span><b>${formatNumber(sumCoins)}💰</b></div><div><span>🔧 Будет списано</span><b>${formatNumber(sumParts)}🔧</b></div><div><span>📦 У тебя</span><b>${formatNumber(currentCoins(p))}💰 / ${formatNumber(p.parts || 0)}🔧</b></div></div>`, confirmText: 'Да, улучшить' });
    if (!ok) return;
  }
  const data = await postJson('/api/farm/building/upgrade', { key, count });
  if (!data.ok) {
    const p = data.profile || state?.profile || {};
    const b = (data.buildings || []).find((item) => item.key === key);
    const needCoins = Number(b?.upgradeCost?.coins || data.nextCost || 0);
    const needParts = Number(b?.upgradeCost?.parts || data.nextParts || 0);
    const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
    showMessage(`❌ Здание не улучшено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
    await loadMe();
    return;
  }
  showPrettyModal({ title: `🏗 ${data.name || data.building}`, subtitle: 'Здание улучшено', body: `<div class="result-mini-grid"><div><span>⬆️ Улучшено</span><b>+${formatNumber(data.upgraded || 0)} ур.</b></div><div><span>💰 Списано</span><b>${formatNumber(data.totalCost || 0)}💰</b></div><div><span>🔧 Списано</span><b>${formatNumber(data.totalParts || 0)}🔧</b></div></div>`, autoCloseMs: 7000, kind: 'success' });
  showMessage(`⬆️ ${data.name || data.building}: +${data.upgraded} ур. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

function describePayload(payload = {}, type = '') {
  if (!payload || typeof payload !== 'object') return '';
  if (type === 'sync_wizebot_push' || type === 'sync_wizebot_push_failed') {
    return payload.ok ? `🔄 Пуш в WizeBot выполнен. Ключей обновлено: ${Array.isArray(payload.keys) ? payload.keys.length : 0}` : `⚠️ Ошибка пуша в WizeBot${payload.message ? ': ' + payload.message : ''}`;
  }
  if (type === 'upgrade') return `Улучшено уровней: ${formatNumber(payload.upgraded || 0)} · списано ${formatNumber(payload.totalCost || 0)}💰${payload.totalParts ? ' / ' + formatNumber(payload.totalParts) + '🔧' : ''}`;
  if (type === 'case_open') return `Открыт кейс за ${formatNumber(payload.cost || 0)}💰 · приз ${prizeLabel(payload.prize)}`;
  if (type === 'gamus_claim') return `Получено ${formatNumber(payload.money || 0)}💎 и ${formatNumber(payload.parts || 0)}🔧 · тир ${formatNumber(payload.tierLevel || 0)}`;
  if (type === 'off_collect') return `Оффсбор: +${formatNumber(payload.income || 0)}💰${payload.partsIncome ? ' / +' + formatNumber(payload.partsIncome) + '🔧' : ''} за ${formatNumber(payload.minutes || 0)} мин.`;
  if (type === 'market_buy_parts') return `Покупка: ${formatNumber(payload.qty || 0)}🔧 за ${formatNumber(payload.totalCost || 0)}💎`;
  if (type === 'market_sell_parts') return `Продажа: ${formatNumber(payload.qty || 0)}🔧 за ${formatNumber(payload.totalCost || 0)}💎`;
  if (type === 'license_buy') return `Куплена лицензия до ${formatNumber(payload.licenseLevel || 0)} уровня за ${formatNumber(payload.cost || payload.spent || 0)}💰`;
  if (type === 'raid' || payload.stolen !== undefined || payload.turret_refund !== undefined) {
    const blockedByTurret = !!(payload.raid_blocked_by_turret || payload.killed_by_turret || payload.turret_triggered);
    return blockedByTurret ? `Рейд на ${payload.target || 'цель'} отбит турелью · списано с атакующего ${formatNumber(payload.turret_refund || 0)}💰` : `Рейд на ${payload.target || 'цель'} · украдено ${formatNumber(payload.stolen || 0)}💰 и ${formatNumber(payload.bonus_stolen || 0)}💎`;
  }
  const parts = [];
  if (payload.building) parts.push('здание: ' + payload.building);
  if (payload.upgraded !== undefined) parts.push('+' + payload.upgraded + ' ур.');
  if (payload.totalCost !== undefined) parts.push(formatNumber(payload.totalCost) + '💰');
  if (payload.totalParts !== undefined) parts.push(formatNumber(payload.totalParts) + '🔧');
  if (payload.amount !== undefined) parts.push('изменение: ' + formatNumber(payload.amount));
  if (payload.next !== undefined) parts.push('итог: ' + formatNumber(payload.next));
  if (payload.income !== undefined) parts.push('доход: ' + formatNumber(payload.income));
  if (payload.partsIncome !== undefined) parts.push('запчасти: ' + formatNumber(payload.partsIncome));
  if (payload.cost !== undefined) parts.push('цена: ' + formatNumber(payload.cost));
  if (payload.money !== undefined) parts.push('монеты: ' + formatNumber(payload.money));
  if (payload.parts !== undefined) parts.push('детали: ' + formatNumber(payload.parts));
  if (payload.oldLogin && payload.newLogin) parts.push(payload.oldLogin + ' → ' + payload.newLogin);
  if (payload.stock !== undefined) parts.push('склад: ' + formatNumber(payload.stock));
  if (payload.debt !== undefined) parts.push('долг: ' + formatNumber(payload.debt));
  return parts.join(' | ') || 'Событие выполнено';
}

function renderAdminPlayer(profile) {
  const box = document.getElementById("admin-player-info");
  if (!box) return;
  if (!profile) { box.innerHTML = ""; return; }
  const login = (profile.twitch_login || profile.login || '').toLowerCase();
  box.innerHTML = `
    <div class="admin-player-card pretty-admin-player">
      <div class="admin-player-top"><b>${login || 'unknown'}</b><span>ур. ${profile.level ?? 0}</span></div>
      <div class="admin-profile-grid">
        <div class="admin-mini-card"><span>🌾 Баланс фермы</span><b>${formatNumber(profile.farm_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="farm" placeholder="+1000 / -1000"><button data-admin-quick-action="give-farm-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>💎 Бонусные</span><b>${formatNumber(profile.upgrade_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="upgrade" placeholder="+1кк / -500к"><button data-admin-quick-action="give-upgrade-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>🔧 Запчасти</span><b>${formatNumber(profile.parts ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="parts" placeholder="+1000 / -1000"><button data-admin-quick-action="give-parts">Применить</button></div></div>
        <div class="admin-mini-card"><span>🌾 Уровень</span><b>${formatNumber(profile.level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="level" placeholder="120"><button data-admin-quick-action="set-level">Применить</button></div></div>
        <div class="admin-mini-card"><span>🛡 Защита</span><b>${formatNumber(profile.protection_level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="protection" placeholder="0-120"><button data-admin-quick-action="set-protection">Применить</button></div></div>
        <div class="admin-mini-card"><span>⚔️ Рейд-сила</span><b>${formatNumber(profile.raid_power ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="raid" placeholder="0-200"><button data-admin-quick-action="set-raid-power">Применить</button></div></div>
        <div class="admin-mini-card"><span>🎟 Лицензия</span><b>${formatNumber(profile.license_level ?? 0)}</b><small>редактирование пока через команды/БД</small></div>
      </div>
      <div class="admin-player-actions-row"><button type="button" data-admin-refresh-player>Обновить игрока</button><button type="button" data-admin-sync-player>Импорт из WizeBot</button><button type="button" data-admin-push-player>Пуш в WizeBot</button></div>
    </div>
  `;
  box.querySelector('[data-admin-refresh-player]')?.addEventListener('click', () => refreshAdminPlayer().catch((e) => setAdminStatus(e.message, true)));
  box.querySelector('[data-admin-sync-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('import-legacy-farm', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelector('[data-admin-push-player]')?.addEventListener('click', async () => {
    try { const data = await adminPost('push-to-wizebot', { login }); renderAdminPlayer(data.profile); setAdminStatus(data.message); } catch (e) { setAdminStatus(e.message, true); }
  });
  box.querySelectorAll('[data-admin-quick-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const action = btn.getAttribute('data-admin-quick-action');
        const keyMap = { 'give-farm-balance': 'farm', 'give-upgrade-balance': 'upgrade', 'give-parts': 'parts', 'set-level': 'level', 'set-protection': 'protection', 'set-raid-power': 'raid' };
        const key = keyMap[action];
        const value = box.querySelector(`[data-admin-quick-input="${key}"]`)?.value;
        const body = { login };
        if (action === 'give-farm-balance') body.amount = value;
        if (action === 'give-upgrade-balance') body.amount = value;
        if (action === 'give-parts') body.amount = value;
        if (action === 'set-level') body.level = value;
        if (action === 'set-protection') body.level = value;
        if (action === 'set-raid-power') body.level = value;
        const data = await adminPost(action, body);
        renderAdminPlayer(data.profile);
        setAdminStatus(data.message);
      } catch (e) { setAdminStatus(e.message, true); }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const collectBtn = document.getElementById('collectBtn');
  if (collectBtn) collectBtn.style.display = 'none';
});
