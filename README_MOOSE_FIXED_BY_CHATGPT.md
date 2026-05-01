# Moose Farm fixes

Исправлено в этой сборке:

1. `/bridge/wizebot-sync` теперь использует `importPayloadToSqlite()` и умеет создавать игроков из WizeBot payload, даже если они ещё не заходили на сайт.
2. `globals.farm_parts_stock`, `globals.farm_parts_sold_total`, `globals.farm_parts_bought_total` теперь импортируются в `farm.market`.
3. Защита от двойных кликов теперь блокирует все farm POST-действия пользователя одним ключом, а не только одинаковый endpoint.
4. Сохранение результата рейда теперь делается в SQLite transaction: атакующий, цель и лог пишутся атомно.
5. Таймеры больше не показывают `896м`; если осталось больше часа, UI показывает часы и минуты, например `14ч 56м`.

Основные изменённые файлы:
- `routes/bridgeRoutes.js`
- `routes/apiRoutes.js`
- `services/wizebotBridgeImportService.js`
- `public/app.js`
