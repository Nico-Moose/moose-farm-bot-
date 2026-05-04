/* Split from 08-feature-overrides.js. Logic unchanged. */
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
    const st = resourceStatus(p, nextCost.coins, nextCost.parts);
    const maxed = isBuilt && maxLevel && lvl >= maxLevel;
    const affordAll = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0));
    const afford10 = calcAffordableLevelsDetailed(conf, lvl, currentCoins(p), Number(p.parts || 0), 10);
    const reason = levelLocked ? `нужен ${requiredLevel} ур. фермы, сейчас ${farmLevel}` : maxed ? 'здание уже на максимуме' : affordAll.stop || 'ресурсов хватает';
    const nextBenefit = maxed ? 'максимум уже достигнут' : buildingNextBenefit(key, conf, lvl, nextLevel);
    return `
      <div class="building-card stage-building-card clean-building-card ${levelLocked ? 'locked-building' : st.coinsOk && st.partsOk ? 'ready-building' : 'shortage-building'}">
        <div class="building-title-row"><h3>${conf.name || key}</h3><span class="building-badge">${isBuilt ? `ур. ${lvl}${maxLevel ? '/' + maxLevel : ''}` : 'не построено'}</span></div>
        <div class="clean-building-status"><div><span>Требование</span><b>${requiredLevel ? `${requiredLevel} ур. фермы` : 'нет'}</b></div><div><span>Статус</span><b>${reason}</b></div></div>
        <div class="clean-cost-grid"><div><span>Следующий</span><b>${maxed ? 'MAX' : nextLevel + ' ур.'}</b></div><div><span>Цена</span><b>${stageFormat(nextCost.coins)}💰<br>${stageFormat(nextCost.parts)}🔧</b></div><div><span>У тебя</span><b>${stageFormat(currentCoins(p))}💰<br>${stageFormat(p.parts || 0)}🔧</b></div><div><span>Хватит</span><b>${levelLocked || maxed ? '—' : `${stageFormat(affordAll.count)} ур.`}</b></div></div>
        <div class="stage-benefit">✨ Следующий уровень: <b>${nextBenefit}</b></div>
        ${!levelLocked && !maxed ? `<div class="stage-mini-note">Для +10 реально доступно: <b>${stageFormat(afford10.count)} ур.</b>; цена доступной пачки: <b>${stageFormat(afford10.totalCoins)}💰 / ${stageFormat(afford10.totalParts)}🔧</b>${afford10.stop ? `; стопор: ${afford10.stop}` : ''}</div>` : `<div class="stage-mini-note warning">${reason}</div>`}
        ${!isBuilt ? `<button data-building-buy="${key}" ${levelLocked ? 'disabled' : ''} title="${levelLocked ? reason : 'Купить здание'}">🏗 Купить</button>` : `<div class="building-actions"><button data-building-upgrade="${key}" data-count="1" ${maxed || levelLocked ? 'disabled' : ''} title="${reason}">⬆️ Ап +1</button><button data-building-upgrade="${key}" data-count="10" ${maxed || levelLocked || afford10.count < 1 ? 'disabled' : ''} title="${afford10.stop || 'Апнуть до 10 уровней'}">🚀 Ап +10</button></div>`}
      </div>`;
  }).join('');
  document.querySelectorAll('[data-building-buy]').forEach((btn) => btn.addEventListener('click', async () => buyBuilding(btn.getAttribute('data-building-buy'))));
  document.querySelectorAll('[data-building-upgrade]').forEach((btn) => btn.addEventListener('click', async () => upgradeBuilding(btn.getAttribute('data-building-upgrade'), Number(btn.getAttribute('data-count') || 1))));
}

function renderAdminPlayer(profile) {
  const box = document.getElementById("admin-player-info");
  if (!box) return;
  if (!profile) { box.innerHTML = ""; return; }
  const login = (profile.twitch_login || profile.login || '').toLowerCase();
  box.innerHTML = `
    <div class="admin-player-card pretty-admin-player clean-admin-player">
      <div class="admin-player-top"><b>${login || 'unknown'}</b><span>ур. ${profile.level ?? 0}</span></div>
      <div class="admin-profile-grid">
        <div class="admin-mini-card"><span>🌾 Баланс фермы</span><b>${stageFormat(profile.farm_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="farm" placeholder="+1000 / -1000"><button data-admin-quick-action="give-farm-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>💎 Бонусные</span><b>${stageFormat(profile.upgrade_balance ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="upgrade" placeholder="+1кк / -500к"><button data-admin-quick-action="give-upgrade-balance">Применить</button></div></div>
        <div class="admin-mini-card"><span>🔧 Запчасти</span><b>${stageFormat(profile.parts ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="parts" placeholder="+1000 / -1000"><button data-admin-quick-action="give-parts">Применить</button></div></div>
        <div class="admin-mini-card"><span>🌾 Уровень</span><b>${stageFormat(profile.level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="level" placeholder="120"><button data-admin-quick-action="set-level">Применить</button></div></div>
        <div class="admin-mini-card"><span>🛡 Защита</span><b>${stageFormat(profile.protection_level ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="protection" placeholder="0-120"><button data-admin-quick-action="set-protection">Применить</button></div></div>
        <div class="admin-mini-card"><span>⚔️ Рейд-сила</span><b>${stageFormat(profile.raid_power ?? 0)}</b><div class="admin-inline-edit"><input data-admin-quick-input="raid" placeholder="0-200"><button data-admin-quick-action="set-raid-power">Применить</button></div></div>
        <div class="admin-mini-card"><span>🎟 Лицензия</span><b>${stageFormat(profile.license_level ?? 0)}</b><small>редактирование через уровни/профиль</small></div>
      </div>
      <div class="admin-player-actions-row"><button type="button" data-admin-refresh-player>Обновить игрока</button><button type="button" data-admin-sync-player>Импорт из WizeBot</button><button type="button" data-admin-push-player>Пуш в WizeBot</button></div>
      <div id="admin-backup-list"></div>
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
        if (action === 'give-farm-balance' || action === 'give-upgrade-balance' || action === 'give-parts') body.amount = value;
        if (action === 'set-level' || action === 'set-protection' || action === 'set-raid-power') body.level = value;
        const data = await adminPost(action, body);
        renderAdminPlayer(data.profile);
        setAdminStatus(data.message);
      } catch (e) { setAdminStatus(e.message, true); }
    });
  });
  renderAdminBackups(login);
}


/* === HOTFIX: strict market + clean combat + readable buildings/info === */
function marketCanBuyQty(q, stock, buyPrice, upgradeBalance) {
  q = Number(q || 0);
  const maxByBalance = Math.floor(Number(upgradeBalance || 0) / Math.max(1, Number(buyPrice || 1)));
  return {
    ok: q > 0 && q <= Number(stock || 0) && q <= maxByBalance,
    maxCanBuy: Math.max(0, Math.min(Number(stock || 0), maxByBalance)),
    maxByBalance
  };
}

function renderMarket(data) {
  const box = document.getElementById('marketBox');
  if (!box) return;

  const market = data.market || {};
  const stock = Number(market.stock || 0);
  const sellPrice = Number(market.sellPrice || 10);
  const buyPrice = Number(market.buyPrice || 20);
  const profile = data.profile || {};
  const upgradeBalance = Number(profile.upgrade_balance || 0);
  const parts = Number(profile.parts || 0);
  const maxBuy = Math.max(0, Math.min(stock, Math.floor(upgradeBalance / Math.max(1, buyPrice))));
  const maxSell = Math.max(0, parts);
  const startQty = Math.max(1, Number(lastMarketQty || 1000));

  box.innerHTML = `
    <div class="market-hero clean-market-hero strict-market-hero">
      <div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>можешь купить: ${stageFormat(maxBuy)}🔧</small></div>
      <div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>можешь продать: ${stageFormat(maxSell)}🔧</small></div>
    </div>
    <div class="market-wallet polished-wallet"><span>💎 Баланс: <b>${stageFormat(upgradeBalance)}</b></span><span>🔧 Запчасти: <b>${stageFormat(parts)}</b></span></div>
    <div class="market-preset-row market-preset-row-fixed">
      <button data-market-preset="1000">1к</button>
      <button data-market-preset="10000">10к</button>
      <button data-market-preset="100000">100к</button>
      <button data-market-preset="1000000">1кк</button>
      <button data-market-preset="buyMax">макс купить</button>
      <button data-market-preset="sellMax">макс продать</button>
    </div>
    <div class="market-actions pretty-actions polished-market-actions clean-market-actions">
      <input id="marketQty" type="text" inputmode="text" value="${formatHumanInputValue(startQty)}" placeholder="1к / 100к / 1кк / 100кк" />
      <button id="marketBuyBtn" ${maxBuy < 1 ? 'disabled' : ''}>🔵 Купить</button>
      <button id="marketSellBtn" ${maxSell < 1 ? 'disabled' : ''}>🟢 Продать</button>
    </div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history"><b>История сделок</b>${stageMarketHistory.length ? stageMarketHistory.map(h=>`<div><span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span> ${h.action==='buy'?'🔵 куплено':'🟢 продано'} <b>${stageFormat(h.qty)}🔧</b> за <b>${stageFormat(h.cost)}💎</b></div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>'}</div>
  `;

  const qtyInput = document.getElementById('marketQty');
  const buyBtn = document.getElementById('marketBuyBtn');
  const sellBtn = document.getElementById('marketSellBtn');

  const recalc = () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    lastMarketQty = q;
    localStorage.setItem('mooseFarmLastMarketQty', String(q));
    const buyCost = q * buyPrice;
    const sellGain = q * sellPrice;
    const buyCheck = marketCanBuyQty(q, stock, buyPrice, upgradeBalance);
    const canSellExact = q > 0 && q <= parts;
    const warnings = [];

    if (!buyCheck.ok) warnings.push(`купить ${stageFormat(q)}🔧 нельзя: максимум доступно ${stageFormat(buyCheck.maxCanBuy)}🔧`);
    if (!canSellExact) warnings.push(`продать ${stageFormat(q)}🔧 нельзя: максимум доступно ${stageFormat(parts)}🔧`);

    if (buyBtn) buyBtn.disabled = !buyCheck.ok;
    if (sellBtn) sellBtn.disabled = !canSellExact;

    const calc = document.getElementById('marketCalc');
    if (calc) {
      calc.innerHTML =
        `Калькулятор: купить <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(buyCost)}💎</b> · продать <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(sellGain)}💎</b><br>` +
        `<span class="${buyCheck.ok ? 'okline' : 'warning'}">${buyCheck.ok ? '✅ Покупка доступна ровно на это количество.' : `⚠️ Покупка не выполнится. Укажи не больше ${stageFormat(buyCheck.maxCanBuy)}🔧.`}</span>` +
        `${!canSellExact ? `<br><span class="warning">⚠️ Продажа не выполнится. Укажи не больше ${stageFormat(parts)}🔧.</span>` : ''}`;
    }
  };
  qtyInput?.addEventListener('input', recalc);
  qtyInput?.addEventListener('blur', () => { qtyInput.value = formatHumanInputValue(parseHumanQty(qtyInput.value)); recalc(); });
  recalc();

  document.querySelectorAll('[data-market-preset]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.marketPreset;
    const value = v === 'buyMax' ? Math.max(1, maxBuy) : v === 'sellMax' ? Math.max(1, maxSell) : Number(v);
    qtyInput.value = formatHumanInputValue(value);
    recalc();
  }));
  buyBtn?.addEventListener('click', () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    const check = marketCanBuyQty(q, stock, buyPrice, upgradeBalance);
    if (!check.ok) {
      showMessage(`❌ Рынок: купить ${stageFormat(q)}🔧 нельзя. Максимум сейчас ${stageFormat(check.maxCanBuy)}🔧. Укажи верное количество.`);
      return;
    }
    marketTrade('buy');
  });
  sellBtn?.addEventListener('click', () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    if (q > parts) {
      showMessage(`❌ Рынок: продать ${stageFormat(q)}🔧 нельзя. У тебя только ${stageFormat(parts)}🔧.`);
      return;
    }
    marketTrade('sell');
  });
}

async function marketTrade(action) {
  const qtyInput = document.getElementById('marketQty');
  const qty = parseHumanQty(qtyInput?.value || '0');
  if (qty > 0) {
    lastMarketQty = qty;
    localStorage.setItem('mooseFarmLastMarketQty', String(qty));
  }
  const data = await postJson(`/api/farm/market/${action}`, { qty });
  if (!data.ok) {
    const labels = {
      invalid_quantity: 'укажи количество больше 0. Можно писать 1к, 100к или 1кк',
      quantity_too_large: `слишком большое число, максимум ${stageFormat(data.maxQty || 0)}🔧`,
      not_enough_parts: `не хватает запчастей: можно продать максимум ${stageFormat(data.available || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎: можно купить максимум ${stageFormat(data.maxCanBuy || 0)}🔧. Нужно ${stageFormat(data.needed || 0)}💎, есть ${stageFormat(data.available || 0)}💎`,
      market_stock_empty: 'общий склад пуст',
      not_enough_market_stock: `на общем складе недостаточно 🔧: можно купить максимум ${stageFormat(data.maxCanBuy || data.stock || 0)}🔧`
    };
    showMessage(`❌ Рынок: ${labels[data.error] || data.error}`);
    await loadMe();
    return;
  }

  pushMarketHistory({ action, qty: data.qty || qty, cost: data.totalCost || 0 });
  showPrettyModal({
    title: action === 'buy' ? '🏪 Покупка завершена' : '🏪 Продажа завершена',
    body: `<div class="result-mini-grid"><div><span>${action === 'buy' ? '🔧 Куплено' : '🔧 Продано'}</span><b>${stageFormat(data.qty)}🔧</b></div><div><span>${action === 'buy' ? '💎 Потрачено' : '💎 Получено'}</span><b>${stageFormat(data.totalCost)}💎</b></div><div><span>📦 Общий склад</span><b>${stageFormat(data.market?.stock ?? 0)}🔧</b></div></div>`,
    autoCloseMs: 7000,
    kind: 'success'
  });
  showActionToast(action === 'buy' ? '🏪 Покупка на рынке' : '🏪 Продажа на рынке', [
    action === 'buy' ? `Куплено: <b>${stageFormat(data.qty)}🔧</b>` : `Продано: <b>${stageFormat(data.qty)}🔧</b>`,
    action === 'buy' ? `Потрачено: <b>${stageFormat(data.totalCost)}💎</b>` : `Получено: <b>${stageFormat(data.totalCost)}💎</b>`
  ], { kind: 'market' });
  await loadMe();
}

