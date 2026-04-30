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
        ${next ? `⬆️ Следующий уровень ${next.level}: <b>${formatNumber(next.cost)}</b>` : '✅ Максимальный уровень'}
      </div>
    </div>
  `;

  document.getElementById('upgrade1Text').textContent = next
    ? `${formatNumber(next.cost)} монет`
    : 'максимум';
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

  showMessage(`✅ Собрано: ${formatNumber(data.income)} монет за ${data.minutes} мин.`);
  await loadMe();
});

document.getElementById('upgrade1Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 1 });

  if (!data.ok) {
    showMessage('⛔ Не хватает монет для улучшения.');
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}`);
  await loadMe();
});

document.getElementById('upgrade10Btn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/upgrade', { count: 10 });

  if (!data.ok) {
    showMessage('⛔ Не хватает монет для улучшения.');
    await loadMe();
    return;
  }

  showMessage(`⬆️ Улучшено уровней: ${data.upgraded}. Потрачено: ${formatNumber(data.totalCost)}`);
  await loadMe();
});

document.getElementById('testBalanceBtn').addEventListener('click', async () => {
  const data = await postJson('/api/farm/test-balance');

  showMessage(`💰 Добавлено ${formatNumber(data.amount)} тестовых монет.`);
  await loadMe();
});
document.getElementById('syncWizebotBtn').addEventListener('click', async () => {
  const raw = prompt(
    'Вставь JSON из WizeBot для nico_moose:',
    JSON.stringify({
      farm: {
        level: 120,
        resources: {
          parts: 0
        }
      },
      farm_balance: 0,
      upgrade_balance: 0
    }, null, 2)
  );

  if (!raw) return;

  let payload;

  try {
    payload = JSON.parse(raw);
  } catch (error) {
    showMessage('❌ Неверный JSON.');
    return;
  }

  const data = await postJson('/api/farm/sync-wizebot', payload);

  if (!data.ok) {
    showMessage(`❌ Sync ошибка: ${data.error}`);
    return;
  }

  showMessage('✅ WizeBot данные синхронизированы для Nico_Moose.');
  await loadMe();
});
loadMe();
