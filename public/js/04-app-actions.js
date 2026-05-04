/* Moose Farm frontend split module: загрузка профиля, API helpers, кнопки главной и переключение вкладок
   Safe-refactor: extracted from public/app.js without logic changes. */
async function loadMe() {
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      location.href = '/';
      return;
    }

    let data = await res.json();

    // ВАЖНО: при обновлении страницы НЕ делаем WizeBot API sync.
    // Страница читает локальную SQLite-базу.
    // WizeBot обновляется вручную через !синкферма / LongText bridge.

    render(data);
    if (typeof refreshHistoryIfVisible === 'function') {
      refreshHistoryIfVisible();
    } else if (typeof loadHistory === 'function') {
      loadHistory().catch((err) => console.warn('[HISTORY]', err));
    }
  } catch (error) {
    document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
    console.error(error);
  }
}

async function postJson(url, body = {}) {
  const lockKey = url + ':' + JSON.stringify(body || {});
  if (clientPendingPosts.has(lockKey)) {
    return { ok: false, error: 'action_in_progress', message: 'Действие уже выполняется' };
  }

  clientPendingPosts.add(lockKey);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { ok: false, error: 'bad_json_response', raw: text };
    }

    if (!res.ok && data.ok !== false) {
      data.ok = false;
      data.error = `http_${res.status}`;
    }

    return data;
  } finally {
    clientPendingPosts.delete(lockKey);
  }
}

async function buyLicense() {
  const data = await postJson('/api/farm/license/buy');

  if (!data.ok) {
    if (data.error === 'not_enough_money') {
      const p = data.profile || state?.profile || {};
      showMessage(`⛔ Не хватает монет на лицензию.\n${formatNeedLine(p, data.needed || data.cost || 0, 0)}`);
    } else if (data.error === 'all_licenses_bought') {
      showMessage('✅ Все лицензии уже куплены.');
    } else {
      showMessage(`❌ Ошибка лицензии: ${data.error}`);
    }
    await loadMe();
    return;
  }

  showMessage(`🎟 Куплена лицензия до ${data.licenseLevel} уровня за ${formatNumber(data.cost)}💰`);
  await loadMe();
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

  if (action === 'buy') {
    showMessage(`🔵 Куплено ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎${data.limited ? ' (сколько хватило)' : ''}`);
    showActionToast('🏪 Покупка на рынке', [
      `Куплено: <b>${formatNumber(data.qty)}🔧</b>`,
      `Потрачено: <b>${formatNumber(data.totalCost)}💎</b>`,
      `Склад после сделки: <b>${formatNumber(data.market?.stock ?? 0)}🔧</b>`,
      `Следующее количество сохранено: <b>${formatNumber(lastMarketQty)}🔧</b>`
    ], { kind: 'market' });
  } else {
    showMessage(`🟢 Продано ${formatNumber(data.qty)}🔧 за ${formatNumber(data.totalCost)}💎`);
    showActionToast('🏪 Продажа на рынке', [
      `Продано: <b>${formatNumber(data.qty)}🔧</b>`,
      `Получено: <b>${formatNumber(data.totalCost)}💎</b>`,
      `Склад после сделки: <b>${formatNumber(data.market?.stock ?? 0)}🔧</b>`,
      `Следующее количество сохранено: <b>${formatNumber(lastMarketQty)}🔧</b>`
    ], { kind: 'market' });
  }

  await loadMe();
}

async function buyBuilding(key) {
  const data = await postJson('/api/farm/building/buy', { key });

  if (!data.ok) {
    const p = data.profile || state?.profile || {};
    const b = (data.buildings || []).find((item) => item.key === key);
    const needCoins = Number(data.totalCost || b?.buyCost?.coins || 0);
    const needParts = Number(data.totalParts || b?.buyCost?.parts || 0);
    const details = needCoins || needParts ? `\n${formatNeedLine(p, needCoins, needParts)}` : '';
    showMessage(`❌ Здание не куплено: ${buildingErrorLabel(data.error || data.stopReason, data)}${details}`);
    await loadMe();
    return;
  }

  showMessage(`✅ Куплено: ${data.name || data.building}. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

async function upgradeBuilding(key, count) {
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

  showMessage(`⬆️ ${data.name || data.building}: +${data.upgraded} ур. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
  await loadMe();
}

function farmUpgradeErrorMessage(data) {
  if (data.stopReason === 'license_required' || data.error === 'license_required') {
    const req = data.requiredLicense;
    return req
      ? `🎟 Нужна лицензия до ${req.level} уровня. Цена: ${formatNumber(req.cost)}💰`
      : '🎟 Нужна лицензия для следующего уровня.';
  }

  const p = data.profile || state?.profile || {};
  const next = data.nextUpgrade || state?.nextUpgrade;
  const reason = data.stopReason || data.error || 'не хватает ресурсов';
  const label = reason === 'not_enough_money' ? 'не хватает монет' : reason === 'not_enough_parts' ? 'не хватает запчастей' : reason;
  const details = next ? `\n${formatNeedLine(p, next.cost, next.parts)}` : '';
  return `⛔ Не удалось улучшить ферму: ${label}${details}`;
}

document.getElementById('collectBtn').addEventListener('click', async () => {
  if (state?.harvestManagedByWizebot) {
    showMessage('🌾 Урожай собирается автоматически командой !урожай в WizeBot и сам подтягивается на сайт.');
    return;
  }

  const data = await postJson('/api/farm/collect');

  if (!data.ok && data.error === 'harvest_managed_by_wizebot') {
    showMessage(data.message || '🌾 Урожай собирается автоматически через WizeBot.');
    await loadMe();
    return;
  }

  if (!data.ok && data.error === 'cooldown') {
    showMessage(`⏳ Сбор будет доступен через ${formatTime(data.remainingMs)}`);
    await loadMe();
    return;
  }

  showMessage(`✅ Собрано: ${formatNumber(data.income)} монет${data.partsIncome ? ` и ${formatNumber(data.partsIncome)}🔧` : ''} за ${data.minutes} мин.`);
  await loadMe();
});

document.getElementById('upgrade1Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 1 });

  if (!data.ok) {
    showMessage(farmUpgradeErrorMessage(data));
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('upgrade10Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 10 });

  if (!data.ok) {
    showMessage(farmUpgradeErrorMessage(data));
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('syncWizebotBtn').addEventListener('click', async () => {
  showMessage('🔄 Синхронизация запускается через команду !синкферма в Twitch-чате.');
});

function openFarmTab(name) {
  const target = name || 'main';
  document.querySelectorAll('.farm-tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.getAttribute('data-farm-panel') === target);
  });
  document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-farm-tab') === target && btn.classList.contains('farm-tab'));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initVisualPanels() {
  document.querySelectorAll('[data-farm-tab]').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => openFarmTab(btn.getAttribute('data-farm-tab')));
  });
}

initVisualPanels();

loadMe();
