# PATCH: safe split of routes/adminRoutes.js

## Что сделано
Без изменения URL, ответов и общей логики большой файл `routes/adminRoutes.js` разнесён на несколько register-модулей.

## Новая структура
- `routes/adminRoutes.js` — основной роутер, общие helper-функции, сборка context и подключение модулей
- `routes/admin/registerAdminFieldAndLookupRoutes.js` — загрузка игрока, список игроков, список фермеров, редактирование одного поля
- `routes/admin/registerAdminSyncRoutes.js` — stream status и sync/import/push маршруты WizeBot
- `routes/admin/registerAdminMutationRoutes.js` — опасные и изменяющие действия: delete farmer/farm, cooldowns, здания, балансы, уровни
- `routes/admin/registerAdminToolsRoutes.js` — transfer, backups, checklist, events, debt, market stock, roulette, cases, gamus

## Что важно
- маршруты и их пути не менялись
- frontend менять не нужно
- server.js менять не нужно
- split сделан только для облегчения поддержки файла

## Изменённые файлы
- `routes/adminRoutes.js`
- `routes/admin/registerAdminFieldAndLookupRoutes.js`
- `routes/admin/registerAdminSyncRoutes.js`
- `routes/admin/registerAdminMutationRoutes.js`
- `routes/admin/registerAdminToolsRoutes.js`
