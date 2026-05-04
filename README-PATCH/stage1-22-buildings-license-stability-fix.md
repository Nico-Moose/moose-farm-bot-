# stage1-22-buildings-license-stability-fix

Что исправлено:
- вкладка `Здания` снова дорисовывается надёжно при открытии и при `loadMe()`, если она активна;
- добавлен безопасный helper `refreshBuildingsIfVisible(force)`;
- `nextLicense` больше не залипает как `{}` при live-merge ответов;
- блок `Лицензии` теперь полностью скрывается, если следующая лицензия отсутствует или payload невалидный (`undefined`, `0`, пустой объект).

Что изменено:
- `public/js/07-ui-overrides.js`
- `public/js/10b-case-tabs-loader.js`
- `public/js/10c-buildings-combat-ui.js`
- `public/js/10e-instant-upgrade-refresh.js`

Что не менялось:
- серверная логика зданий;
- API;
- рынок;
- рейды / кейсы / sync.
