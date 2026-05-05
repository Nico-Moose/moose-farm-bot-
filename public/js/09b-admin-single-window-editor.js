function editableProfileField(label, field, value, suffix = '') {
  return `
    <label class="editable-profile-field">
      <span>${label}</span>
      <input data-profile-edit-field="${field}" type="number" value="${Number(value || 0)}" />
      ${suffix ? `<em>${suffix}</em>` : ''}
    </label>`;
}

async function saveEditableProfileField(field, value) {
  const login = adminLoginValue?.();
  if (!login) return setAdminStatus?.('Укажи игрока', true);
  const data = await adminPost('player/set-field', { login, field, value });
  setAdminStatus?.(`Поле ${field} обновлено`);
  if (data.profile) renderAdminEditableProfile(data.profile);
}

function renderAdminEditableProfile(profile) {
  const host = document.getElementById('admin-player-info');
  if (!host || !profile) return;

  const farm = profile.farm || {};
  const resources = farm.resources || {};
  const turret = profile.turret || {};
  const buildings = farm.buildings || {};
  const buildingList = Object.keys(buildings).filter(k => Number(buildings[k] || 0) > 0);

  host.innerHTML = `
    <div class="admin-edit-profile-card">
      <div class="admin-edit-profile-head">
        <div>
          <h3>${profile.display_name || profile.twitch_login || profile.login}</h3>
          <small>@${profile.login || profile.twitch_login}</small>
        </div>
        <button id="admin-refresh-profile-edit" type="button">↻ Обновить</button>
      </div>

      <div class="editable-profile-grid">
        ${editableProfileField('🌾 Уровень', 'level', profile.level)}
        ${editableProfileField('🌾 Ферма', 'farm_balance', profile.farm_balance)}
        ${editableProfileField('💎 Бонусные', 'upgrade_balance', profile.upgrade_balance)}
        ${editableProfileField('🔧 Запчасти', 'parts', profile.parts ?? resources.parts)}
        ${editableProfileField('📜 Лицензия', 'license_level', profile.license_level)}
        ${editableProfileField('⚔️ Рейд-сила', 'raid_power', profile.raid_power)}
        ${editableProfileField('🛡 Защита', 'protection_level', profile.protection_level)}
        ${editableProfileField('🔫 Турель ур.', 'turret_level', turret.level)}
        ${editableProfileField('🎯 Турель шанс', 'turret_chance', turret.chance, '%')}
      </div>

      <div class="admin-edit-actions">
        <button id="admin-save-all-visible-fields" type="button">💾 Сохранить все поля</button>
      </div>

      <div class="admin-edit-section">
        <h4>🏗 Постройки</h4>
        <div class="admin-edit-buildings">
          ${buildingList.length ? buildingList.map(k => `<div><b>${k}</b><span>ур. ${stageFormat(buildings[k])}</span></div>`).join('') : '<p>Построек нет.</p>'}
        </div>
      </div>
    </div>`;

  document.getElementById('admin-refresh-profile-edit')?.addEventListener('click', () => refreshAdminPlayer?.());

  document.getElementById('admin-save-all-visible-fields')?.addEventListener('click', async () => {
    const inputs = Array.from(document.querySelectorAll('[data-profile-edit-field]'));
    for (const input of inputs) {
      await saveEditableProfileField(input.dataset.profileEditField, input.value);
    }
    setAdminStatus?.('Все поля сохранены и применены');
    await refreshAdminPlayer?.();
  });

  document.querySelectorAll('[data-profile-edit-field]').forEach((input) => {
    input.addEventListener('change', async () => {
      await saveEditableProfileField(input.dataset.profileEditField, input.value);
    });
  });
}

// Override old card renderer: now edit profile in the same admin window.
renderAdminPlayer = function(profile) {
  if (!profile) {
    const host = document.getElementById('admin-player-info');
    if (host) host.innerHTML = '';
    return;
  }
  renderAdminEditableProfile(profile);
};

// Override view button: do not open second modal, scroll to editor.
async function adminViewPlayerAsProfile() {
  const login = adminLoginValue?.();
  if (!login) return setAdminStatus?.('Укажи ник игрока', true);
  const data = await adminGet(`player/${encodeURIComponent(login)}`);
  renderAdminEditableProfile(data.profile || {});
  document.getElementById('admin-player-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setAdminStatus?.('Профиль открыт в этом же окне. Поля можно редактировать.');
}

function removeFloatingBackupPanel() {
  const floating = document.getElementById('backupPreviewPanel');
  if (floating) floating.remove();
}

function bootSingleWindowAdminFix() {
  removeFloatingBackupPanel();
  ensureAdminBackupTab();
  installAdminLoginClearButton?.();
  installAdminViewButton?.();
}

document.addEventListener('DOMContentLoaded', () => {
  bootSingleWindowAdminFix();
  setTimeout(bootSingleWindowAdminFix, 700);
  setTimeout(bootSingleWindowAdminFix, 1800);
});
setInterval(bootSingleWindowAdminFix, 2500);
