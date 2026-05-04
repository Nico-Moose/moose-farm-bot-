# Stage 1.15 — admin journal read cache + prepared statements

Что сделано:
- в `routes/adminJournalRoutes.js` добавлен короткий read-cache для:
  - `GET /api/admin/journal/players`
  - `GET /api/admin/journal/events`
- вынесены prepared statements для:
  - поиска `twitch_id` по login,
  - списка игроков,
  - count/list запросов журнала по 4 безопасным вариантам фильтра:
    - только `days`
    - `login`
    - `type`
    - `login + type`

Что не менялось:
- URL маршрутов
- JSON-формат ответов
- логика фильтрации
- игровые механики, рынок, рейды, кейсы, WizeBot sync

Зачем:
- уменьшить повторные чтения БД при частом открытии админ-журнала и автокомплита игроков;
- не собирать заново одинаковые SQL-запросы на каждом запросе.
