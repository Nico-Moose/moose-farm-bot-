# Stage 1.8 — safe split of admin balances block

Что сделано:
- из `routes/adminRoutes.js` вынесен безопасный блок `balances` в новый файл `routes/admin/registerAdminBalanceRoutes.js`;
- вынесены только маршруты:
  - `POST /api/admin/give-farm-balance`
  - `POST /api/admin/give-upgrade-balance`
  - `POST /api/admin/give-parts`
- URL, входные поля, ответы и побочные эффекты сохранены 1 в 1;
- игровые механики, рынок, sync и опасные admin-действия не трогались.

Почему именно этот блок:
- он локальный;
- почти не связан с danger/sync/backups;
- его можно вынести механически без смены поведения.

Что проверить после замены:
1. Выдача фермерского баланса из админки.
2. Выдача бонусного баланса из админки.
3. Выдача запчастей из админки.
4. Что preview игрока после действий возвращает обновлённый профиль.
5. Что история admin-событий продолжает писать `admin_farm_balance`, `admin_upgrade_balance`, `admin_parts`.
