let state = null;

function formatNumber(num) {
  num = Number(num) || 0;

  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(1).replace('.0', '') + 'трлн';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace('.0', '') + 'млрд';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'кк';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace('.0', '') + 'к';

  return String(Math.floor(num));
}

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}м ${String(s).padStart(2, '0')}с`;
}

function showMessage(text) {
  document.getElementById('message').textContent = text || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getErrorText(error) {
  const map = {
    building_not_found: 'Здание не найдено.',
    farm_level_too_low: 'Недостаточный уровень фермы.',
    building_already_built: 'Здание уже построено.',
    not_enough_money: 'Не хватает монет.',
    not_enough_parts: 'Не хватает запчастей.',
    building_not_built: 'Сначала построй здание.',
    max_level: 'Максимальный уровень здания.',
    factory_requires_zavod_10: 'Для фабрики выше 5 ур. нужен завод 10 ур.',
    mine_requires_zavod_50_factory_50: 'Шахта до 25 ур. требует завод 50 и фабрику 50.',
    mine_requires_zavod_100_factory_100: 'Шахта до 50 ур. требует завод 100 и фабрику 100.',
    mine_requires_zavod_125_factory_125: 'Шахта до 75 ур. требует завод 125 и фабрику 125.',
    mine_requires_zavod_200_factory_200: 'Шахта до 100 ур. требует завод 200 и фабрику 200.',
    mine_requires_zavod_300_factory_300: 'Шахта с 200 ур. требует завод 300 и фабрику 300.'
  };

  return map[error] || error || 'Неизвестная ошибка.';
}

function render(data) {
  state = data;
  renderProfile(data);
  renderBuildings(data.buildings || []);
}

function renderProfile(data) {
  const el = document.getElementById('profile');
  const p = data.profile;
  const next = data.nextUpgrade;

  const syncText = p.last_wizebot_sync_at
    ? new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU')
    : 'ещё не было';

  el.innerHTML = `
    <div class="profile">
      ${data.user.avatarUrl ? `<img src="${escapeHtml(data.user.avatarUrl)}" alt="avatar">` : ''}
      <div>
        <b>${escapeHtml(data.user.displayName)}</b><br>
        🌾 Уровень фермы: <b>${formatNumber(p.level)}</b><br>
        💰 Баланс фермы: <b>${formatNumber(p.farm_balance)}</b><br>
        💎 Ап-баланс: <b>${formatNumber(p.upgrade_balance)}</b><br>
        🔧 Запчасти: <b>${formatNumber(p.parts)}</b><br>
        📈 Доход всего: <b>${formatNumber(p.total_income)}</b><br>
        🛡 Защита: <b>${formatNumber(p.protection_level || 0)}</b><br>
        ⚔️ Рейд-сила: <b>${formatNumber(p.raid_power || 0)}</b><br>
        🔄 WizeBot sync: <b>${syncText}</b><br>
        ${next ? `⬆️ Следующий уровень ${next.level}: <b>${formatNumber(next.cost)}</b>${next.parts ? ` / ${formatNumber(next.parts)}🔧` : ''}` : '✅ Максимальный уровень'}
      </div>
    </div>
  `;

  document.getElementById('upgrade1Text').textContent = next
    ? `${formatNumber(next.cost)} монет`
    : 'максимум';
}

function renderBuildings(buildings) {
  const el = document.getElementById('buildings');

  if (!buildings.length) {
    el.innerHTML = '<p>Здания не загружены. Сделай !синкферма.</p>';
    return;
  }

  el.innerHTML = buildings.map((b) => {
    const name = escapeHtml(b.name);
    const key = escapeHtml(b.key);

    const status = b.isBuilt
      ? `ур. ${formatNumber(b.level)}/${formatNumber(b.maxLevel)}`
      : 'не построено';

    const cost = b.isBuilt
      ? `Ап ${b.nextLevel}: ${formatNumber(b.upgradeCost.coins)}💰 / ${formatNumber(b.upgradeCost.parts)}🔧`
      : `Цена: ${formatNumber(b.buyCost.coins)}💰 / ${formatNumber(b.buyCost.parts)}🔧`;

    const access = `Доступно с ур. фермы: ${formatNumber(b.levelRequired)}`;

    let buttons = '';

    if (!b.canAccess) {
      buttons = '<small>🔒 Недоступно по уровню фермы</small>';
    } else if (!b.isBuilt) {
      buttons = `<button data-building-buy="${key}">🏗 Купить</button>`;
    } else if (b.canUpgrade) {
      buttons = `
        <button data-building-upgrade="${key}" data-count="1">⬆️ Ап +1</button>
        <button data-building-upgrade="${key}" data-count="10">⬆️ Ап +10</button>
      `;
    } else {
      buttons = '<small>✅ Максимум</small>';
    }

    return `
      <article class="building-card">
        <h3>${name}</h3>
        <b>${status}</b><br>
        <small>${cost}</small><br>
        <small>${access}</small>
        <div class="building-actions">${buttons}</div>
      </article>
    `;
  }).join('');
}

async function loadMe() {
  try {
    const res = await fetch('/api/me');

    if (res.status === 401) {
      location.href = '/';
      return;
    }

    const data = await res.json();
    render(data);
  } catch (error) {
    document.getElementById('profile').textContent = 'Ошибка загрузки профиля';
    console.error(error);
  }
}

async function postJson(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  return res.json();
}

document.getElementById('collectBtn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/collect');

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
    showMessage(`⛔ Ап фермы не выполнен: ${getErrorText(data.stopReason || data.error)}`);
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('upgrade10Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 10 });

  if (!data.ok) {
    showMessage(`⛔ Ап фермы не выполнен: ${getErrorText(data.stopReason || data.error)}`);
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰${data.totalParts ? ` / ${formatNumber(data.totalParts)}🔧` : ''}`);
  await loadMe();
});

document.getElementById('testBalanceBtn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/test-balance');

  showMessage(`💰 Добавлено ${formatNumber(data.amount)} тестовых монет.`);
  await loadMe();
});

document.getElementById('syncWizebotBtn').addEventListener('click', async () => {
  showMessage('🔄 Для синка напиши в Twitch: !синкферма');
});

document.getElementById('buildings').addEventListener('click', async (event) => {
  const buyKey = event.target.dataset.buildingBuy;
  const upgradeKey = event.target.dataset.buildingUpgrade;

  if (buyKey) {
    const data = await postJson(`/api/farm/buildings/${encodeURIComponent(buyKey)}/buy`);

    if (!data.ok) {
      showMessage(`⛔ Здание не куплено: ${getErrorText(data.error)}`);
      await loadMe();
      return;
    }

    showMessage(`✅ Куплено: ${buyKey} за ${formatNumber(data.costCoins)}💰 и ${formatNumber(data.costParts)}🔧`);
    await loadMe();
    return;
  }

  if (upgradeKey) {
    const count = Number(event.target.dataset.count || 1);
    const data = await postJson(`/api/farm/buildings/${encodeURIComponent(upgradeKey)}/upgrade`, { count });

    if (!data.ok) {
      showMessage(`⛔ Здание не улучшено: ${getErrorText(data.error || data.stopReason)}`);
      await loadMe();
      return;
    }

    showMessage(`⬆️ ${upgradeKey}: +${data.upgraded} ур. Потрачено ${formatNumber(data.totalCoins)}💰 и ${formatNumber(data.totalParts)}🔧`);
    await loadMe();
  }
});

loadMe();
