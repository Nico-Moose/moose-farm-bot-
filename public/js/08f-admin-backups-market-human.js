/* Split from 08-feature-overrides.js. Logic unchanged. */
async function renderAdminBackups(login){
  const box=document.getElementById('admin-backup-list'); if(!box || !login) return;
  try{ const data=await adminGet('backups?login='+encodeURIComponent(login)); const backups=data.backups||[]; box.innerHTML=`<div class="backup-panel"><h3>🧯 Backup / restore</h3><p>Можно восстановить весь профиль или отдельный блок.</p>${backups.length?backups.map(b=>`<div class="backup-row"><div><b>${new Date(b.createdAt||0).toLocaleString('ru-RU')}</b><small>${b.reason} · ур. ${b.level} · 🌾${stageFormat(b.farm_balance)} · 💎${stageFormat(b.upgrade_balance)} · 🔧${stageFormat(b.parts)}</small><small>Здания: ${Object.keys(b.buildings||{}).length} · кейсы: ${b.caseHistoryCount} · рейды: ${b.raidLogsCount}</small></div><div class="backup-actions"><button data-restore-index="${b.index}" data-restore-block="all">Всё</button><button data-restore-index="${b.index}" data-restore-block="balances">Балансы</button><button data-restore-index="${b.index}" data-restore-block="progression">Прогресс</button><button data-restore-index="${b.index}" data-restore-block="farm">Ферма</button></div></div>`).join(''):'<p>Бэкапов пока нет.</p>'}</div>`; box.querySelectorAll('[data-restore-index]').forEach(btn=>btn.addEventListener('click',async()=>{const index=Number(btn.dataset.restoreIndex); const block=btn.dataset.restoreBlock; const ok=await confirmFarmModal({title:'Восстановить backup?',body:`Будет восстановлен блок: <b>${block}</b><br>Backup #${index+1}. Перед восстановлением создаётся новый backup.`}); if(!ok)return; const res=await adminPost('restore-backup-index',{login,index,block}); setAdminStatus(res.message); renderAdminPlayer(res.profile); })); }catch(e){ box.innerHTML='<p class="error">Не удалось загрузить backup: '+e.message+'</p>'; }
}
const prevRenderAdminPlayer = renderAdminPlayer;
function renderAdminPlayer(profile){
  prevRenderAdminPlayer(profile);
  const box=document.getElementById('admin-player-info'); if(!box || !profile) return;
  let backupBox=document.getElementById('admin-backup-list'); if(!backupBox){ backupBox=document.createElement('div'); backupBox.id='admin-backup-list'; box.appendChild(backupBox); }
  renderAdminBackups((profile.twitch_login||profile.login||'').toLowerCase());
}


/* === HOTFIX 2026-05-03: market shorthand, buildings layout, admin stack === */
function parseHumanQty(value) {
  let raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  if (!raw) return 0;
  let mult = 1;
  if (raw.endsWith('кк') || raw.endsWith('kk')) { mult = 1000000; raw = raw.slice(0, -2); }
  else if (raw.endsWith('к') || raw.endsWith('k')) { mult = 1000; raw = raw.slice(0, -1); }
  else if (raw.endsWith('м') || raw.endsWith('m')) { mult = 1000000; raw = raw.slice(0, -1); }
  else if (raw.endsWith('млрд') || raw.endsWith('b')) { mult = 1000000000; raw = raw.replace(/млрд|b$/g, ''); }
  let num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num * mult);
}

function formatHumanInputValue(n) {
  n = Math.max(1, Math.floor(Number(n || 1)));
  if (n >= 1000000 && n % 1000000 === 0) return (n / 1000000) + 'кк';
  if (n >= 1000 && n % 1000 === 0) return (n / 1000) + 'к';
  return String(n);
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
  const buyMaxByBalance = Math.floor(upgradeBalance / Math.max(1, buyPrice));
  const buyMax = Math.max(0, Math.min(stock, buyMaxByBalance));
  const sellMax = Math.max(0, parts);
  const startQty = Math.max(1, Number(lastMarketQty || 1000));

  box.innerHTML = `
    <div class="market-hero polished-market-hero stage-market-hero clean-market-hero">
      <div class="market-stat"><span>📦 Общий склад</span><b>${stageFormat(stock)}🔧</b><small>один склад для всех игроков</small></div>
      <div class="market-stat"><span>🔵 Купить</span><b>${stageFormat(buyPrice)}💎 / 1🔧</b><small>макс купить: ${stageFormat(buyMax)}🔧</small></div>
      <div class="market-stat"><span>🟢 Продать</span><b>${stageFormat(sellPrice)}💎 / 1🔧</b><small>макс продать: ${stageFormat(sellMax)}🔧</small></div>
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
      <input id="marketQty" type="text" inputmode="text" value="${formatHumanInputValue(startQty)}" placeholder="1к / 100к / 1кк" />
      <button id="marketBuyBtn" ${buyMax < 1 ? 'disabled' : ''}>🔵 Купить</button>
      <button id="marketSellBtn" ${sellMax < 1 ? 'disabled' : ''}>🟢 Продать</button>
    </div>
    <div id="marketCalc" class="market-calc"></div>
    <div class="market-history"><b>История сделок</b>${stageMarketHistory.length ? stageMarketHistory.map(h=>`<div><span>${new Date(h.ts).toLocaleTimeString('ru-RU')}</span> ${h.action==='buy'?'🔵 куплено':'🟢 продано'} <b>${stageFormat(h.qty)}🔧</b> за <b>${stageFormat(h.cost)}💎</b></div>`).join('') : '<p>Пока нет сделок в этой сессии.</p>'}</div>`;

  const qtyInput = document.getElementById('marketQty');
  const recalc = () => {
    const q = Math.max(1, parseHumanQty(qtyInput?.value || '1'));
    lastMarketQty = q;
    localStorage.setItem('mooseFarmLastMarketQty', String(q));
    const buyCost = q * buyPrice;
    const sellGain = q * sellPrice;
    const warnings = [];
    if (q > stock) warnings.push(`покупка упрётся в общий склад: доступно ${stageFormat(stock)}🔧`);
    if (buyCost > upgradeBalance) warnings.push(`покупка упрётся в баланс: нужно ${stageFormat(buyCost)}💎, есть ${stageFormat(upgradeBalance)}💎`);
    if (q > parts) warnings.push(`продажа упрётся в твои запчасти: есть ${stageFormat(parts)}🔧`);
    const calc = document.getElementById('marketCalc');
    if (calc) calc.innerHTML = `Калькулятор: купить <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(buyCost)}💎</b> · продать <b>${stageFormat(q)}🔧</b> = <b>${stageFormat(sellGain)}💎</b>${warnings.length ? `<br><span class="warning">⚠️ ${warnings.join(' · ')}</span>` : ''}`;
  };
  qtyInput?.addEventListener('input', recalc);
  qtyInput?.addEventListener('blur', () => { qtyInput.value = formatHumanInputValue(parseHumanQty(qtyInput.value)); recalc(); });
  recalc();

  document.querySelectorAll('[data-market-preset]').forEach(btn => btn.addEventListener('click', () => {
    const v = btn.dataset.marketPreset;
    const value = v === 'buyMax' ? Math.max(1, buyMax) : v === 'sellMax' ? Math.max(1, sellMax) : Number(v);
    qtyInput.value = formatHumanInputValue(value);
    recalc();
  }));
  document.getElementById('marketBuyBtn')?.addEventListener('click', () => marketTrade('buy'));
  document.getElementById('marketSellBtn')?.addEventListener('click', () => marketTrade('sell'));
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
      not_enough_parts: `не хватает запчастей: ${stageFormat(data.available || 0)}/${stageFormat(data.needed || 0)}🔧`,
      not_enough_upgrade_balance: `не хватает 💎: ${stageFormat(data.available || 0)} / ${stageFormat(data.needed || 0)}`,
      market_stock_empty: 'общий склад пуст',
      not_enough_market_stock: 'на общем складе недостаточно 🔧'
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

