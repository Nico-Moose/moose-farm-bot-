# Stage 1.16 — safe micro-batch (4 micro-fixes)

Base: `moose-farm-bot--main (11).zip`

## Что входит

Этот патч делает **4 маленьких safe-fix разом** и не трогает рынок, рейды, кейсы, WizeBot sync и core-геймплей.

### 1. adminJournalRoutes: read-cache + prepared statements
Файл: `routes/adminJournalRoutes.js`

- добавлен короткий read-cache для `/players` и `/events`;
- вынесены prepared statements для players lookup, login -> twitch_id и 4 безопасных вариантов фильтра журнала (`all`, `login`, `type`, `login+type`).

### 2. История: lazy refresh только когда вкладка реально нужна
Файлы:
- `public/js/01-core-main.js`
- `public/js/04-app-actions.js`
- `public/js/10b-case-tabs-loader.js`
- `public/js/10d-live-refresh-stale.js`

- добавлены helpers `isFarmTabActive`, `refreshHistoryIfVisible`, `refreshTopsIfVisible`;
- `loadMe()` и `refreshVisibleData()` больше не дёргают историю вслепую;
- убран legacy-wrapper в `10d-live-refresh-stale.js`, который пытался передавать URL в `loadHistory()`, хотя базовая функция его не использовала.

### 3. История: защита от устаревших запросов + защита от повторного bind админки
Файл: `public/js/06-admin-history.js`

- `loadHistory()` теперь отменяет предыдущий запрос и не даёт старому ответу перетереть новый;
- `bindAdminPanel()` теперь не навешивает обработчики повторно.

### 4. Топы: lazy-load только для открытой вкладки + stale-request guard
Файлы:
- `public/js/10b-case-tabs-loader.js`
- `public/js/10f-history-raid-case-offcollect.js`
- `public/js/01-core-main.js`

- топы грузятся только когда открыта вкладка `tops/info` или есть явный force-refresh;
- новый запрос отменяет предыдущий;
- старый ответ больше не может перетереть свежий UI.

## Что НЕ менялось

- рынок;
- серверная логика торговли;
- здания/апгрейды как механика;
- рейды/кейсы/off-collect как серверная логика;
- WizeBot / bridge / farm_v2 контракты.

## Проверка

Проверено `node --check` для изменённых JS/route файлов.
