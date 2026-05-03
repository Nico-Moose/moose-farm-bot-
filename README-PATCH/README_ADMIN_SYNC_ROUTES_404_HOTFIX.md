# Admin Sync Routes 404 Hotfix

Дата: 2026-05-03

Что исправлено:
- Кнопки админки вызывали `POST` маршруты:
  - `/api/admin/sync-from-wizebot`
  - `/api/admin/push-to-wizebot`
  - `/api/admin/sync-harvest-from-wizebot`
- В backend эти маршруты отсутствовали, поэтому админка получала `404`.
- Добавлены недостающие маршруты.
- Импорт из WizeBot теперь возвращает нормальное сообщение и профиль.
- README лежит в `README-PATCH`.
