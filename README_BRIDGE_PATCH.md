# Moose Farm Bridge Patch

Этот ZIP добавляет безопасный bridge sync из старой WizeBot-фермы в новую SQLite сайт-ферму.

## Что заменять в проекте

Скопируй файлы из архива в проект с заменой:

- `config.js` -> заменить
- `server.js` -> заменить
- `services/dbService.js` -> заменить
- `services/userService.js` -> заменить
- `services/wizebotBridgeService.js` -> добавить
- `routes/bridgeRoutes.js` -> добавить
- `routes/apiRoutes.js` -> заменить
- `public/app.js` -> заменить
- `public/farm.html` -> заменить

## Переменные окружения

Добавь в `.env` или в панель bothost:

```env
WIZEBOT_BRIDGE_SECRET=любой_длинный_секрет
```

Такой же секрет вставь в WizeBot-команду вместо:

```js
PASTE_YOUR_WIZEBOT_BRIDGE_SECRET_HERE
```

## WizeBot команда

Создай новую JS-команду в WizeBot:

```txt
!синкферма
```

Код возьми из:

```txt
wizebot_commands/!синкферма.txt
```

Команда читает старые переменные:

- `farm_nico_moose`
- `farm_virtual_balance_nico_moose`
- `farm_upgrade_balance_nico_moose`
- `farm_total_income_nico_moose`
- `farm_last_nico_moose`
- `farm_license_nico_moose`
- `farm_protection_level_nico_moose`
- `farm_raid_power_nico_moose`
- `farm_defense_building_nico_moose`

и отправляет их на сайт:

```txt
POST /bridge/wizebot-sync
```

## Важно

Сначала Nico_Moose должен хотя бы один раз войти на сайт через Twitch, чтобы профиль появился в SQLite.

## Если WizeBot JS не поддерживает fetch()

Если команда выдаст ошибку `fetch is not defined`, значит в JS-командах WizeBot нельзя делать POST-запросы напрямую.
Тогда используем fallback:

1. WizeBot-команда создаёт longtext/JSON с данными.
2. Сайт импортирует этот JSON вручную или через отдельный endpoint.

Но сначала проверь основной вариант — во многих JS sandbox `fetch` доступен.
