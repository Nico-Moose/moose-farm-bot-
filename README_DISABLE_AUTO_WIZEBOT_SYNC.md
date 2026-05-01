# Fix: отключён авто-sync WizeBot при обновлении страницы

Удалён автоматический вызов `POST /api/farm/sync-wizebot` из `public/app.js`.
Теперь обновление страницы читает только SQLite, без WizeBot API.
Sync остаётся ручным через `!синкферма` / LongText bridge.
