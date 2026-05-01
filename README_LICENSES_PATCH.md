# Moose Farm Licenses Patch

Патч добавляет лицензии фермы как в WizeBot.

## Что добавлено

- `services/farm/licenseService.js`
- endpoint `POST /api/farm/license/buy`
- поле `nextLicense` в `GET /api/me`
- UI-блок лицензий на странице `/farm`
- улучшенный upgradeService: если уровень требует лицензию, ап останавливается с `license_required`

## Как установить

1. Скопируй файлы из ZIP в проект с заменой:
   - `routes/apiRoutes.js`
   - `public/app.js`
   - `public/farm.html`
   - `services/farm/licenseService.js`
   - `services/farm/paymentService.js`
   - `services/farm/upgradeService.js`

2. Содержимое `public/style-additions-licenses.css` вставь в конец:
   - `public/style.css`

3. Перезапусти сервер.

4. В Twitch напиши:
   - `!синкферма`

5. На сайте сделай Ctrl+F5.

## Важно

Лицензии берутся из WizeBot config:

```js
farm_data_licenses = {
  "40": 7000,
  "60": 12000,
  "80": 22000,
  "100": 35000,
  "120": 50000
}
```

Если `configs.licenses` пустой — сделай `!синкферма`, потому что сайт получает эти данные через longtext bridge.
