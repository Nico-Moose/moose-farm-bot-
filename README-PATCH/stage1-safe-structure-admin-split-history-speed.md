# Stage 1 safe-patch: admin structure split + narrow history cleanup + non-game speed patch

## Что изменено

### 1) Декомпозиция `routes/adminRoutes.js`
Без изменения URL и контрактов вынесены отдельные группы:

- `routes/admin/registerAdminSyncRoutes.js`
  - import/sync/push WizeBot
- `routes/admin/registerAdminBalanceRoutes.js`
  - balance / level / protection / raid power / reset raid cooldown / delete buildings / delete farm
- `routes/admin/registerAdminBackupRoutes.js`
  - transfer / market stock / clear debt / reset gamus / reset cases / delete turret / backup restore / checklist / admin events / backups list

Сам `routes/adminRoutes.js` оставлен как точка сборки, общие helper-функции сохранены на месте.

### 2) Узкая зачистка безопасной фронтовой зоны
Файл:
- `public/js/06-admin-history.js`

Сделано:
- защита от повторного bind на `DOMContentLoaded`
- abort предыдущего запроса при быстром повторном refresh/change
- отдельный fetch для `/api/admin/events` с тем же контрактом ответа
- игнор тихих `AbortError`, чтобы не сыпать ложные ошибки в UI

Зона затронута только история/админ-журнал.

### 3) Точечные speed-патчи в неигровых местах
Сделано только для админских/неигровых путей:

- в `routes/adminRoutes.js`
  - подготовленный SQL + короткий cache для `/api/admin/players`
- в `routes/admin/registerAdminBackupRoutes.js`
  - короткий cache для `/api/admin/events`
- в `public/js/06-admin-history.js`
  - отмена устаревших запросов истории/админ-событий

## Дополнительно

- убран дублирующийся helper `restoreFarmBackup` в `routes/adminRoutes.js`

## Что специально НЕ трогалось

- рынок
- игровые API сайта
- `routes/apiRoutes.js`
- `caseService.js`
- `profileShape.js`
- `offCollectService.js`
- live-refresh игровой части

## Проверка

Проверено синтаксически:

- `routes/adminRoutes.js`
- `routes/admin/registerAdminSyncRoutes.js`
- `routes/admin/registerAdminBalanceRoutes.js`
- `routes/admin/registerAdminBackupRoutes.js`
- `public/js/06-admin-history.js`

Полный runtime-запуск в контейнере не выполнялся, потому что локально не установлены project dependencies (`express` и др.).
