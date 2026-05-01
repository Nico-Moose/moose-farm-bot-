# Patch: buildings + parts market

Что изменено:

1. `services/farm/buildingService.js`
   - Исправлен импорт: `spendMoney` заменён на существующий `spendCoins`.
   - Откаты списания теперь используют `money.spent.farm_balance` и `money.spent.upgrade_balance`.
   - Ответы покупки/апгрейда зданий приведены к единому формату:
     - `totalCost`
     - `totalParts`

2. `routes/apiRoutes.js`
   - Ответы API зданий теперь возвращают `totalCost/totalParts`.
   - Добавлены endpoints рынка:
     - `POST /api/farm/market/buy` с body `{ "qty": 100 }`
     - `POST /api/farm/market/sell` с body `{ "qty": 100 }`
   - В `/api/me` добавлен объект `market`.

3. `services/farm/marketService.js`
   - Добавлена логика рынка запчастей по WizeBot-командам:
     - продажа: `1🔧 = 10💎`
     - покупка: `1🔧 = 20💎`
     - стартовый склад: `20000🔧`
     - максимум за раз: `2000000🔧`
   - Рынок хранится внутри `profile.farm.market`.

4. `public/farm.html`, `public/app.js`, `public/style.css`
   - Добавлен блок рынка в Web UI.
   - Можно купить/продать запчасти с сайта.

Следующие шаги после этого патча:
- рейды;
- защита;
- турель;
- обратная синхронизация сайт -> WizeBot.
