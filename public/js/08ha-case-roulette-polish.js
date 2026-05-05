/* === HOTFIX: exact case roulette winner + multiplied prizes === */
const CASE_PRIZES_UI_FULL = [
  { type: 'coins', value: 150000 }, { type: 'parts', value: 12500 }, { type: 'coins', value: 125000 }, { type: 'parts', value: 19000 }, { type: 'coins', value: 110000 },
  { type: 'parts', value: 15000 }, { type: 'coins', value: 180000 }, { type: 'parts', value: 17000 }, { type: 'coins', value: 135000 }, { type: 'parts', value: 13500 },
  { type: 'coins', value: 145000 }, { type: 'parts', value: 14500 }, { type: 'coins', value: 100000 }, { type: 'parts', value: 20000 }, { type: 'coins', value: 130000 },
  { type: 'parts', value: 16000 }, { type: 'coins', value: 155000 }, { type: 'parts', value: 12000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 15500 },
  { type: 'coins', value: 140000 }, { type: 'parts', value: 18000 }, { type: 'coins', value: 170000 }, { type: 'parts', value: 14000 }, { type: 'coins', value: 105000 },
  { type: 'parts', value: 16500 }, { type: 'coins', value: 160000 }, { type: 'parts', value: 17500 }, { type: 'coins', value: 115000 }, { type: 'parts', value: 13000 },
  { type: 'coins', value: 200000 }, { type: 'parts', value: 21000 }, { type: 'coins', value: 120000 }, { type: 'parts', value: 16000 }, { type: 'coins', value: 132000 },
  { type: 'parts', value: 22000 }, { type: 'coins', value: 190000 }, { type: 'parts', value: 15800 }, { type: 'coins', value: 128000 }
];

function casePrizeIcon(type) {
  return type === 'parts' ? '🔧' : '💎';
}

function casePrizeValue(prize) {
  if (!prize) return 0;
  return Number(prize.value ?? prize.finalValue ?? 0) || 0;
}

function casePrizeText(prize) {
  if (!prize) return '—';
  return '+' + formatNumber(casePrizeValue(prize)) + casePrizeIcon(prize.type);
}

function findCasePrizeIndex(prize) {
  if (!prize) return 0;
  const rawIndex = Number(prize.index ?? prize.targetIndex);
  if (Number.isFinite(rawIndex) && rawIndex >= 0) return rawIndex % CASE_PRIZES_UI_FULL.length;

  const baseValue = Number(prize.baseValue || 0);
  if (baseValue > 0) {
    const idx = CASE_PRIZES_UI_FULL.findIndex((p) => p.type === prize.type && Number(p.value) === baseValue);
    if (idx >= 0) return idx;
  }

  const multiplier = Number(prize.multiplier || 1) || 1;
  const final = casePrizeValue(prize);
  if (final > 0) {
    const idx = CASE_PRIZES_UI_FULL.findIndex((p) => p.type === prize.type && Math.floor(Number(p.value) * multiplier) === final);
    if (idx >= 0) return idx;
  }

  return 0;
}

function caseCellHtml(basePrize, multiplier, extraClass = '', forcedValue = null) {
  const finalValue = forcedValue === null ? Math.floor(Number(basePrize.value || 0) * multiplier) : Number(forcedValue || 0);
  return `<div class="case-cell ${extraClass}" data-case-cell="${extraClass ? 'win' : ''}">
    <b>${casePrizeIcon(basePrize.type)}</b>
    <span>${formatNumber(finalValue)}</span>
  </div>`;
}

function showCaseOverlay(prize) {
  const overlay = document.getElementById('caseOverlay');
  if (!overlay) return;

  const multiplier = Number(prize?.multiplier || 1) || 1;
  const winIndex = findCasePrizeIndex(prize);
  const winBase = CASE_PRIZES_UI_FULL[winIndex] || { type: prize?.type || 'coins', value: prize?.baseValue || casePrizeValue(prize) };
  const winValue = casePrizeValue(prize) || Math.floor(Number(winBase.value || 0) * multiplier);

  const items = [];
  // Делаем длинную ленту, но финальная ячейка под указателем = именно выигравший index из сервера.
  for (let i = 0; i < 34; i++) {
    const base = CASE_PRIZES_UI_FULL[(winIndex + 7 + i * 5) % CASE_PRIZES_UI_FULL.length];
    items.push(caseCellHtml(base, multiplier));
  }
  items.push(caseCellHtml(winBase, multiplier, 'case-win', winValue));
  // немного хвоста после победителя, чтобы рулетка выглядела живой
  for (let j = 1; j <= 8; j++) {
    const base = CASE_PRIZES_UI_FULL[(winIndex + j) % CASE_PRIZES_UI_FULL.length];
    items.push(caseCellHtml(base, multiplier));
  }

  overlay.innerHTML = `
    <div class="case-overlay-card case-overlay-card-fixed">
      <h2>🎉 Кейс открыт</h2>
      <div class="case-roulette case-roulette-fixed">
        <div class="case-pointer"></div>
        <div class="case-strip case-strip-fixed">${items.join('')}</div>
      </div>
      <div class="case-result">
        Выигрыш: <b>${casePrizeText({ type: winBase.type, value: winValue })}</b>
        <small>множитель x${multiplier.toFixed(2)} · базовый приз ${formatNumber(winBase.value)}${casePrizeIcon(winBase.type)}</small>
      </div>
      <button id="caseOverlayClose">Закрыть</button>
    </div>
  `;

  overlay.classList.add('active');
  const close = () => overlay.classList.remove('active');
  document.getElementById('caseOverlayClose')?.addEventListener('click', close);

  requestAnimationFrame(() => {
    const roulette = overlay.querySelector('.case-roulette-fixed');
    const strip = overlay.querySelector('.case-strip-fixed');
    const winCell = overlay.querySelector('.case-win');
    if (!roulette || !strip || !winCell) return;

    strip.style.transition = 'none';
    strip.style.transform = 'translateX(0px)';

    requestAnimationFrame(() => {
      const offset = winCell.offsetLeft + (winCell.offsetWidth / 2) - (roulette.clientWidth / 2);
      strip.style.transition = 'transform 2.8s cubic-bezier(.12,.78,.12,1)';
      strip.style.transform = `translateX(-${Math.max(0, offset)}px)`;
    });
  });
}

// openCase тоже переопределяем, чтобы все сообщения брали финальный приз с множителем.
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
  showMessage(`🎰 Кейс: выигрыш ${casePrizeText(data.prize)}. Цена ${formatNumber(data.cost)}💰`);
  await loadMe();
}


