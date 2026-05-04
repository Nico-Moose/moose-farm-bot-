# Stage 1.17 — final microfixes (safe stop point)

## Что сделано

Последние 2 микро-фикса вне игровых зон, без касания рынка, рейдов, кейсов и WizeBot sync.

### 1) `routes/adminJournalRoutes.js`
- добавлен короткий read-cache (`1500ms`) для:
  - `GET /api/admin/journal/players`
  - `GET /api/admin/journal/events`
- вынесены prepared statements для:
  - поиска `twitch_id` по login
  - списка игроков
  - count/list запросов журнала по вариантам:
    - `base`
    - `login`
    - `type`
    - `loginType`
- URL и JSON-формат ответов не менялись.

### 2) `public/js/01-core-main.js`
- `refreshVisibleData()` больше не дёргает `loadHistory()` вслепую
- история обновляется только если реально открыта вкладка `history`
- добавлен helper `isFarmTabActive(name)`

## Что не трогалось
- рынок
- здания
- игровые расчёты
- farm_v2 / WizeBot sync
- danger/backups admin logic

## Проверка
- `node --check routes/adminJournalRoutes.js`
- `node --check public/js/01-core-main.js`
