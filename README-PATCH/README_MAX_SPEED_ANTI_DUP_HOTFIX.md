# MAX SPEED ANTI-DUP HOTFIX

Что исправлено:
- добавлен отсутствующий import `enqueueProfileSync` и `getQueueStats` в `routes/apiRoutes.js`
- устранён крэш сервера `ReferenceError: enqueueProfileSync is not defined`

Симптом до фикса:
- при апгрейде сайт падал в `fastSyncMeta()`
- пользователь видел ошибки вроде `action_in_progress`, потому что запрос завершался аварийно и ломал быстрый контур

Файл:
- `routes/apiRoutes.js`

Что НЕ менялось:
- сама очередь async sync
- логика anti-dup
- фронтовые оптимизации

Это именно hotfix к прошлому патчу, а не новый большой рефактор.
