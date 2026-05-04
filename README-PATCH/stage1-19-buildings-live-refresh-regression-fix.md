# stage1-19-buildings-live-refresh-regression-fix

Что исправлено:
- вернул безопасный live-refresh вкладки `Здания` после `buy/upgrade` без F5;
- при `loadMe()` и `openFarmTab('buildings')` теперь гарантированно делается повторная отрисовка зданий из текущего `state`;
- после успешного `building buy/upgrade` делается локальный `refreshBuildingsIfVisible()` до фонового `loadMe(true)`.

Почему был баг:
- после lazy-cleanup и recover-render для `buildings` вкладка стала восстанавливаться при открытии, но не имела явного post-action refresh пути;
- в части цепочки `loadMe()` / live-action refresh здания могли обновиться только после полного reload/F5.

Что затронуто:
- `public/js/10b-case-tabs-loader.js`
- `public/js/10c-buildings-combat-ui.js`
- `public/js/10d-live-refresh-stale.js`
- `public/js/10e-instant-upgrade-refresh.js`

Что не менялось:
- серверные роуты
- рынок
- рейды / кейсы / sync
- механика цен и апгрейдов
