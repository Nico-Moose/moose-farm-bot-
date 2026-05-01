let state = null;

function formatNumber(num) {
  num = Number(num) || 0;
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

function syncText(p) {
  return p.last_wizebot_sync_at
    ? `🔄 WizeBot sync: <b>${new Date(Number(p.last_wizebot_sync_at)).toLocaleString('ru-RU')}</b>`
    : '🔄 WizeBot sync: ещё не было';
}

function renderBuildings(buildings) {
  const box = document.getElementById('buildingsBox');
  if (!box) return;

  if (!buildings || !buildings.length) {
    box.innerHTML = 'Нет данных зданий. Сделай !синкферма, чтобы подтянуть конфиги.';
    return;
  }

  box.innerHTML = buildings.map((b) => {
    const status = b.built
      ? `ур. ${b.level}${b.maxLevel ? `/${b.maxLevel}` : ''}`
      : `не построено`;

    const info = b.built
      ? `Можно улучшать`
      : `Цена: ${formatNumber(b.buyCost)}💰 / ${formatNumber(b.buyParts)}🔧`;

    const action = b.built
      ? `<button class="building-action" data-action="upgrade" data-key="${b.key}">⬆️ Ап +1</button>
         <button class="building-action" data-action="upgrade10" data-key="${b.key}">⬆️ Ап +10</button>`
      : `<button class="building-action" data-action="buy" data-key="${b.key}">🏗 Купить</button>`;

    return `
      <div class="building-card">
        <b>${b.name}</b><br>
        <span>${status}</span><br>
        <small>${info}</small><br>
        <small>Доступно с ур. фермы: ${b.levelRequired || 0}</small>
        <div class="building-actions">${action}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.building-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const action = btn.dataset.action;

      if (action === 'buy') {
        const data = await postJson('/api/farm/buildings/buy', { key });
        if (!data.ok) showMessage(`❌ Здание: ${translateError(data)}`);
        else showMessage(`✅ Куплено: ${data.name} за ${formatNumber(data.cost)}💰 и ${formatNumber(data.parts)}🔧`);
        await loadMe();
        return;
      }

      const count = action === 'upgrade10' ? 10 : 1;
      const data = await postJson('/api/farm/buildings/upgrade', { key, count });
      if (!data.ok) showMessage(`❌ Ап здания: ${translateError(data)}`);
      else showMessage(`⬆️ ${data.name}: +${data.upgraded} ур., теперь ${data.level}. Потрачено ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts)}🔧`);
      await loadMe();
    });
  });
}

function translateError(data) {
  const error = data.error || data.stopReason || 'unknown_error';
  const map = {
    unknown_building: 'неизвестное здание',
    building_config_missing: 'нет конфига здания, сделай !синкферма',
    building_already_built: 'здание уже построено',
    building_not_built: 'сначала купи здание',
    farm_level_too_low: `нужен уровень фермы ${data.requiredLevel}, сейчас ${data.currentLevel}`,
    not_enough_parts: `не хватает запчастей`,
    not_enough_money: `не хватает монет`,
    factory_requires_zavod_10: 'фабрика выше 5 ур. требует завод 10 ур.',
    mine_requires_zavod_factory_50: 'шахта требует завод и фабрику 50 ур.',
    mine_requires_zavod_factory_100: 'шахта требует завод и фабрику 100 ур.',
    mine_requires_zavod_factory_125: 'шахта требует завод и фабрику 125 ур.',
    mine_requires_zavod_factory_200: 'шахта требует завод и фабрику 200 ур.',
    mine_requires_zavod_factory_300: 'шахта требует завод и фабрику 300 ур.',
    license_required: 'нужна лицензия',
    cooldown: 'кулдаун'
  };
  return map[error] || error;
}

function render(data) {
  state = data;
  const el = document.getElementById('profile');
  const p = data.profile;
  const next = data.nextUpgrade;

  el.innerHTML = `
    <div class="profile">
      ${data.user.avatarUrl ? `<img src="${data.user.avatarUrl}" alt="avatar">` : ''}
      <div>
        <b>${data.user.displayName}</b><br>
        🌾 Уровень фермы: <b>${p.level}</b><br>
        💰 Баланс фермы: <b>${formatNumber(p.farm_balance)}</b><br>
        💎 Ап-баланс: <b>${formatNumber(p.upgrade_balance)}</b><br>
        🔧 Запчасти: <b>${formatNumber(p.parts)}</b><br>
        📈 Доход всего: <b>${formatNumber(p.total_income)}</b><br>
        🛡 Защита: <b>${p.protection_level || 0}</b><br>
        ⚔️ Рейд-сила: <b>${p.raid_power || 0}</b><br>
        ${syncText(p)}<br>
        ${next ? `⬆️ Следующий уровень ${next.level}: <b>${formatNumber(next.cost)}</b>${next.parts ? ` / ${formatNumber(next.parts)}🔧` : ''}` : '✅ Максимальный уровень'}
      </div>
    </div>
  `;

  document.getElementById('upgrade1Text').textContent = next
    ? `${formatNumber(next.cost)} монет${next.parts ? ` / ${formatNumber(next.parts)}🔧` : ''}`
    : 'максимум';

  renderBuildings(data.buildings || []);
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
    headers: { 'Content-Type': 'application/json' },
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
  showMessage(`✅ Собрано: ${formatNumber(data.income)}💰 и ${formatNumber(data.partsIncome || 0)}🔧 за ${data.minutes} мин.`);
  await loadMe();
});

document.getElementById('upgrade1Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 1 });
  if (!data.ok) {
    showMessage(`⛔ ${translateError(data)}.`);
    await loadMe();
    return;
  }
  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
  await loadMe();
});

document.getElementById('upgrade10Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 10 });
  if (!data.ok) {
    showMessage(`⛔ ${translateError(data)}.`);
    await loadMe();
    return;
  }
  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}💰 / ${formatNumber(data.totalParts || 0)}🔧`);
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

loadMe();
