# Stage 1.14 — admin journal read-only cache + prepared statements

Что сделано:
- в `routes/adminJournalRoutes.js` добавлен короткий read-cache для `GET /players` и `GET /events`;
- для основных вариантов фильтра `events` вынесены prepared statements вместо динамического `db.prepare(...)` на каждый запрос;
- контракт ответов и URL не менялись.

Что не трогалось:
- рынок;
- игровые механики;
- WizeBot sync;
- admin write-роуты.

Зачем:
- админ-журнал часто дёргается autocomplete и пагинацией;
- это ускоряет частые одинаковые чтения без изменения поведения.
