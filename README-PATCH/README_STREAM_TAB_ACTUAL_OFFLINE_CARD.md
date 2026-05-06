# PATCH: вкладка Стрим — красивая оффлайн-заставка

## Что сделано
- Вкладка `📺 Стрим` теперь проверяет реальный Twitch-статус через отдельный endpoint `/api/stream/embed-status`.
- Если стрим онлайн — показывается обычный Twitch player.
- Если стрим оффлайн — вместо стандартного Twitch offline embed показывается красивая брендированная заставка.
- Чат справа не изменён.
- Ручной override статуса стрима для игровой логики не влияет на внешний вид плеера во вкладке `Стрим`.

## Изменённые файлы
- `services/streamStatusService.js`
- `routes/apiRoutes.js`
- `public/js/10l-stream-tab.js`
- `public/css/08-stream-tab.css`
