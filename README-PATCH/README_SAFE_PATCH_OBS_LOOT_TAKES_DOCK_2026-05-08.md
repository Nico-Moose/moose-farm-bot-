# Moose Farm safe-patch — OBS dock лог выдач предметов

Дата: 2026-05-08

## Что добавлено
Только отдельный лёгкий лог успешных выдач предметов из донат-инвентаря.

## Изменённые файлы
- `services/dbService.js`
- `services/lootService.js`
- `routes/apiRoutes.js`
- `public/obs-loot-takes.html`

## Как это работает
После успешной выдачи через:
- `/api/loot/take`
- `/api/loot/take-selection`

создаётся отдельная запись в таблице `loot_take_dock_log`.

## OBS
Страница для OBS dock:
- `/obs-loot-takes.html`

API:
- `/api/obs/loot-takes?limit=30`

## Что не менялось
- логика покупки
- логика кейсов
- логика выдачи предметов
- основной UI сайта
