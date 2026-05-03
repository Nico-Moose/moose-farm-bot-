# Router set-field Hotfix

Дата: 2026-05-03

Что исправлено:
- Ошибка `ReferenceError: router is not defined` в `routes/adminRoutes.js`.
- Маршрут `POST /player/set-field` был случайно добавлен до создания `router`.
- Теперь маршрут находится внутри `module.exports = function (db) { ... }`, после создания `router`.
- README лежит в `README-PATCH`.

Проверка:
- `node --check routes/adminRoutes.js` проходит успешно.
