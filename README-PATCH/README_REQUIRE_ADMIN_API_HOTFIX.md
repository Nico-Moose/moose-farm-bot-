# requireAdminApi Hotfix

Дата: 2026-05-03

Что исправлено:
- Ошибка `ReferenceError: requireAdminApi is not defined`.
- В `adminRoutes.js` уже используется общий `router.use(requireAdmin)`, поэтому маршрут `/player/set-field` не должен отдельно ссылаться на `requireAdminApi`.
- Маршрут оставлен защищённым общим admin middleware.

Проверка:
- `node --check routes/adminRoutes.js` проходит успешно.
