# Stage 1.10 — safe split of admin sync routes

Что сделано:
- из `routes/adminRoutes.js` вынесен отдельный локальный блок sync-маршрутов в `routes/admin/registerAdminSyncRoutes.js`;
- сохранены те же URL, body-параметры и JSON-ответы;
- не тронуты `danger`, `backups`, рынок и игровые механики.

Что вынесено:
- `POST /api/admin/import-legacy-farm`
- `POST /api/admin/sync-from-wizebot`
- `POST /api/admin/push-to-wizebot`
- `POST /api/admin/sync-harvest-from-wizebot`

Что важно:
- логика импорта старой фермы и push-back в WizeBot сохранена 1 в 1;
- создание технического профиля для ещё не заходившего игрока сохранено;
- admin log events сохранены.

Проверка:
- `node --check routes/adminRoutes.js`
- `node --check routes/admin/registerAdminSyncRoutes.js`
