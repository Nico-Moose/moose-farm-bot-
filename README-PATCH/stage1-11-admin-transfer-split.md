# STAGE 1.11 — safe split of admin transfer block

Что сделано:
- из `routes/adminRoutes.js` вынесен локальный admin transfer-блок в отдельный регистратор `routes/admin/registerAdminTransferRoutes.js`;
- вынесен только маршрут `POST /api/admin/transfer-farm`;
- URL, body-параметры, JSON-ответ и admin log сохранены 1 в 1;
- добавлены локальные prepared statements внутри transfer-регистратора для двух update-запросов.

Что не менялось:
- market;
- levels / balances / sync / danger / backups;
- игровые механики;
- WizeBot/farm_v2 контракты.

Зачем:
- ещё немного разгрузить `adminRoutes.js` маленьким безопасным куском;
- держать перенос фермы отдельным локальным модулем;
- не трогать опасные admin-блоки.

Проверка:
- `node --check routes/adminRoutes.js`
- `node --check routes/admin/registerAdminTransferRoutes.js`
