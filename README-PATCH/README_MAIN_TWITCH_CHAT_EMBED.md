# README_MAIN_TWITCH_CHAT_EMBED

## Что сделано
- На главной вкладке `/farm` добавлен отдельный аккуратный блок `Twitch chat`.
- Чат вынесен в отдельные файлы:
  - `public/css/07-main-twitch-chat.css`
  - `public/js/10j-main-twitch-chat.js`
- Основная страница меняется минимально:
  - добавлен только контейнер секции в `public/farm.html`
  - подключён новый CSS import в `public/style.css`
  - подключён новый JS-модуль в `public/farm.html`

## Почему это safe-patch
- Нет изменений в backend/API.
- Нет изменений в `public/app.js`.
- Не затронуты рынок, здания, live-refresh, instant-upgrade, admin logic.
- Блок расположен ниже основных first-screen секций, чтобы не ломать текущий anti-CLS bootstrap.

## Поведение
- Twitch chat загружается лениво только для вкладки `Главная`.
- Для embed используется канал `Nico_Moose`.
- `parent` собирается из текущего `window.location.hostname` + добавлены запасные `farm-moose.bothost.tech` и `localhost`.
- Есть кнопка `Открыть в Twitch` и локальная кнопка `Обновить чат`.

## Какие файлы изменены
- `public/farm.html`
- `public/style.css`
- `public/css/07-main-twitch-chat.css`
- `public/js/10j-main-twitch-chat.js`
- `README-PATCH/README_MAIN_TWITCH_CHAT_EMBED.md`

## Что специально не трогалось
- `public/app.js`
- `10d-live-refresh-stale.js`
- `10e-instant-upgrade-refresh.js`
- рынок / buildings / admin routes / farm logic
