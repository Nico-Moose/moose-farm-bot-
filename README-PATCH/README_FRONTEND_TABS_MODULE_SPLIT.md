# FRONTEND TABS MODULE SPLIT SAFE PATCH

Дата: 2026-05-04

Что сделано:
- `public/app.js` больше не содержит огромный фронт-код, он оставлен как маленький compatibility-placeholder.
- Фронт-код вынесен в `public/js/*.js` отдельными файлами.
- `public/farm.html` теперь подключает эти JS-файлы по порядку.
- `public/style.css` не трогался.
- API, рынок, здания, рейды, журнал и админ-логика не переписывались.

Файлы:
- `public/js/01-core-main.js` — общие helpers + главная вкладка.
- `public/js/02-market.js` — базовый рынок.
- `public/js/03-buildings.js` — базовые здания.
- `public/js/04-app-actions.js` — загрузка профиля, API helpers, кнопки главной, вкладки.
- `public/js/05-combat-extras-tops.js` — рейды, кейсы, GAMUS, оффсбор, топ/инфо.
- `public/js/06-admin-history.js` — базовая админка и журнал.
- `public/js/07-ui-overrides.js` — UI overrides/модалки/история.
- `public/js/08-feature-overrides.js` — накопленные overrides по рынку/зданиям/топам/кейсам.
- `public/js/09-admin-overrides.js` — накопленные overrides админ-панели.
- `public/js/10-final-patches.js` — финальные hotfix-патчи по рейдам/рынку/журналу.

Важно:
- Это safe-refactor: код был разрезан на файлы без изменения логики.
- Порядок подключения сохранён, чтобы старые override-патчи работали как раньше.
- Для дальнейшего редактирования лучше постепенно переносить конкретные overrides из `08/10` в профильные файлы, но это уже отдельными маленькими патчами.
