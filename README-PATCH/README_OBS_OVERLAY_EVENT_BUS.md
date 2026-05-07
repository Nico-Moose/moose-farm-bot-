# OBS loot overlay event-bus patch

Что добавлено:
- серверный SSE event-bus для `loot_open` и `loot_take`
- OBS overlay page: `/farm/overlay/loot`
- автоматическая отправка событий в overlay при открытии кейса и забирании предмета

Изменённые файлы:
- `server.js`
- `services/lootService.js`
- `services/lootOverlayBus.js`
- `public/overlay/loot.html`

Как подключить в OBS:
- Browser Source URL: `https://farm-moose.bothost.tech/farm/overlay/loot`
- Width: `1920`
- Height: `1080`
- CSS можно оставить прозрачным, как у тебя на скрине

Как работает:
- сайт сам делает логику кейса/забирания
- после этого сервер отправляет событие в SSE поток `/api/overlay/loot/events`
- overlay page в OBS слушает поток и показывает визуал

Важно:
- старые `WIZEBOT_LOOT_OPEN_COMMAND` и `WIZEBOT_LOOT_TAKE_COMMAND` можно оставить как есть, но для OBS overlay они уже не обязательны
- этот патч не трогает farm_v2 и обычную игровую логику фермы
