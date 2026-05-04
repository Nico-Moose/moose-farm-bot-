# Stage 1.9 — safe split of admin levels block

Что сделано:
- из `routes/adminRoutes.js` вынесен отдельный safe-блок `levels`
- добавлен новый файл `routes/admin/registerAdminLevelRoutes.js`
- в patch также включён `routes/admin/registerAdminBalanceRoutes.js`, чтобы текущий safe-split был самодостаточным поверх базового архива `(11)`

Что вынесено:
- `POST /api/admin/set-level`
- `POST /api/admin/set-protection`
- `POST /api/admin/set-raid-power`

Что сохранено без изменений:
- URL и body-параметры
- ответы API
- логирование admin-событий
- обновление `farm_json.level` через `updateFarmJsonLevel()`

Что не трогалось:
- рынок
- здания
- sync / backups / danger
- игровые механики

Зачем:
- ещё уменьшить размер и связанность `adminRoutes.js`
- продолжить безопасную декомпозицию маленькими кусками 1-в-1
