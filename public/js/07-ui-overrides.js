/* Moose Farm frontend split module: UI overrides: модалки, улучшенный рендер, история
   Safe-refactor: extracted from public/app.js without logic changes. */
/* === FINAL UI / UX PATCH === */
function showPrettyModal({ title = '', subtitle = '', body = '', footer = '', wide = false, autoCloseMs = 0, kind = '' } = {}) {
  let root = document.getElementById('prettyModalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'prettyModalRoot';
    root.className = 'pretty-modal-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="pretty-modal-backdrop ${kind}">
      <div class="pretty-modal-card ${wide ? 'wide' : ''}">
        <button type="button" class="pretty-modal-close">×</button>
        <div class="pretty-modal-head">
          <h3>${title}</h3>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <div class="pretty-modal-body">${body}</div>
        ${footer ? `<div class="pretty-modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
  root.classList.add('active');
  const close = () => {
    root.classList.remove('active');
    setTimeout(() => { if (!root.classList.contains('active')) root.innerHTML = ''; }, 180);
  };
  root.querySelector('.pretty-modal-close')?.addEventListener('click', close);
  root.querySelector('.pretty-modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === root.querySelector('.pretty-modal-backdrop')) close();
  });
  if (autoCloseMs > 0) setTimeout(close, autoCloseMs);
  return { root, close };
}

function confirmFarmModal({ title, body, confirmText = 'Подтвердить', cancelText = 'Отмена', kind = '' } = {}) {
  return new Promise((resolve) => {
    const modal = showPrettyModal({
      title,
      body,
      footer: `<button type="button" class="modal-btn secondary" data-modal-cancel>${cancelText}</button><button type="button" class="modal-btn" data-modal-confirm>${confirmText}</button>`,
      kind
    });
    modal.root.querySelector('[data-modal-cancel]')?.addEventListener('click', () => { modal.close(); resolve(false); });
    modal.root.querySelector('[data-modal-confirm]')?.addEventListener('click', () => { modal.close(); resolve(true); });
  });
}

function showActionToast(title, lines = [], options = {}) {
  const root = ensureModalRoot('actionToastRoot', 'action-toast-root');
  const toast = document.createElement('div');
  toast.className = 'action-toast ' + (options.kind || '');
  toast.innerHTML = `
    <button class="action-toast-close" type="button">×</button>
    <div class="action-toast-title">${title}</div>
    <div class="action-toast-lines">${lines.map((line) => `<div>${line}</div>`).join('')}</div>
  `;
  root.prepend(toast);
  const close = () => toast.remove();
  toast.querySelector('.action-toast-close')?.addEventListener('click', close);
  setTimeout(() => toast.classList.add('visible'), 20);
  setTimeout(close, options.timeout || 9000);
}

function showCaseHistoryModal(history = []) {
  const rows = history.length
    ? history.slice(0, 20).map((item, index) => `
        <div class="history-detail-card">
          <div><b>#${index + 1}</b> · ${new Date(item.date).toLocaleString('ru-RU')}</div>
          <div>🎁 Выигрыш: <b>${prizeLabel(item)}</b></div>
          <div>💰 Цена открытия: <b>${formatNumber(item.cost || 0)}💰</b></div>
          <div>🧮 Тип: <b>${item.type === 'parts' ? 'Запчасти' : 'Бонусные'}</b></div>
        </div>
      `).join('')
    : '<div class="history-detail-card">История кейсов пока пустая.</div>';
  showPrettyModal({ title: '🎰 Последние кейсы', subtitle: 'Полная красивая история последних открытий', body: `<div class="history-detail-grid">${rows}</div>`, wide: true });
}

