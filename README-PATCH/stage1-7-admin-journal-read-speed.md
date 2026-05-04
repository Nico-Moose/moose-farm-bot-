# Stage 1.7 — adminJournalRoutes read-only speed patch

Что сделано:
- ускорен `routes/adminJournalRoutes.js` без изменения URL и формата ответов;
- добавлен короткий read-cache для:
  - `GET /players`
  - `GET /events`
- вынесены и переиспользуются prepared statements для:
  - поиска `twitch_id` по login
  - списка игроков для autocomplete
  - count/list запросов журнала по конкретному `WHERE`.

Что это даёт:
- меньше одинаковых чтений SQLite при частом вводе в autocomplete;
- меньше повторных запросов при пагинации/перекликах в админ-журнале;
- без касания рынка, farm_v2, WizeBot и игровых механик.

Что не менялось:
- маршруты и JSON-контракты;
- логика фильтров `login/type/days/limit/offset`;
- структура payload событий.
