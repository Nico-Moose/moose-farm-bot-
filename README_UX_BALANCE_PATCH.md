# Moose Farm Modular Buildings Patch

Этот патч разделяет код на модули и фиксит баг зданий, когда деньги списывались, но здание не сохранялось.

## Что внутри

### Новые модули
- `services/farm/numberUtils.js`
- `services/farm/profileShape.js`
- `services/farm/paymentService.js`
- `services/farm/upgradeService.js`
- `services/farm/collectService.js`
- `services/farm/buildingService.js`

### Файлы для замены
- `services/farmGameService.js`
- `services/dbService.js`
- `services/userService.js`
- `services/wizebotBridgeImportService.js`
- `routes/apiRoutes.js`
- `public/farm.html`
- `public/app.js`

### CSS
Содержимое `public/style-additions.css` нужно добавить в конец твоего `public/style.css`, если этих классов ещё нет.

## Установка

1. Скопируй файлы из архива в проект с заменой.
2. Убедись, что папка `services/farm/` появилась в проекте.
3. Добавь CSS из `public/style-additions.css` в конец `public/style.css`.
4. Перезапусти сервер.
5. В Twitch напиши `!синкферма`.
6. Сделай `Ctrl + F5` на сайте.

## Что исправлено

- Покупка здания теперь пишет уровень в `profile.farm.buildings[key] = 1`.
- После покупки/апа вызывается `updateProfile`, поэтому `farm_json` сохраняется в SQLite.
- После каждого действия `/api/me` возвращает актуальные `buildings`.
- Баланс и запчасти списываются через отдельный `paymentService`.

## Важно

Сайт всё ещё тратит только SQLite-копии балансов. WizeBot/Twitch валюту сайт не списывает. Это будет отдельным безопасным этапом позже.
