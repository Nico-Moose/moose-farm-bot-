async function loadMe() {
  const el = document.getElementById('profile');
  try {
    const res = await fetch('/api/me');
    if (res.status === 401) {
      location.href = '/';
      return;
    }
    const data = await res.json();
    const p = data.profile;
    el.innerHTML = `
      <div class="profile">
        ${data.user.avatarUrl ? `<img src="${data.user.avatarUrl}" alt="avatar">` : ''}
        <div>
          <b>${data.user.displayName}</b><br>
          Уровень фермы: ${p.level}<br>
          Монеты: ${p.coins}<br>
          XP: ${p.xp}
        </div>
      </div>
    `;
  } catch (error) {
    el.textContent = 'Ошибка загрузки профиля';
    console.error(error);
  }
}
loadMe();
