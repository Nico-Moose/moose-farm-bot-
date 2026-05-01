# Moose Farm full fix: admin extension, history UI, logs, refresh sync

## Добавлено

### 1. Авто-sync WizeBot при обновлении страницы
- При первом открытии `/farm` для `Nico_Moose` сайт пробует вызвать `POST /api/farm/sync-wizebot`.
- Если `WIZEBOT_API_KEY` не задан или WizeBot недоступен, страница не ломается.
- Можно отключить для страницы: `/farm?nosync=1`.

### 2. История и журнал действий
- Новый endpoint: `GET /api/farm/history?type=&limit=100`.
- Новый UI-блок: `📜 Истории и журнал`.
- Фильтры по типу события: апы, здания, рынок, рейды, кейсы, GAMUS, оффсбор.

### 3. Расширенная админка Nico_Moose
Backend защищён через `middleware/requireAdmin.js` по `req.session.twitchUser.login`.

Новые admin endpoints:
- `POST /api/admin/transfer-farm`
- `POST /api/admin/clear-debt`
- `POST /api/admin/reset-cases`
- `POST /api/admin/reset-gamus`
- `POST /api/admin/set-market-stock`
- `GET /api/admin/events`
- `GET /api/admin/checklist`

UI добавлен в админ-панель:
- перенос фермы;
- списание долгов игрока/всех;
- сброс кейсов игрока/всех;
- сброс GAMUS;
- правка склада рынка;
- админ-журнал с фильтрами.

### 4. farm_events
Добавлено чтение событий для UI и админ-журнала.
События игровых действий уже логируются через `logFarmEvent`, новые админ-действия тоже пишутся в `farm_events`.

## Важно
- Обратный sync сайт → WizeBot currency всё ещё не реализован полностью. Это следующий отдельный большой этап.
- Перенос фермы требует, чтобы новый ник хотя бы раз вошёл на сайт через Twitch, чтобы существовал `twitch_users` профиль.
