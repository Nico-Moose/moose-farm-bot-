# Moose Farm Buildings Patch

Патч добавляет покупку и апгрейд зданий на сайт-ферме.

## Что заменить

Скопируй файлы из архива в проект с заменой:

- `services/farmGameService.js`
- `routes/apiRoutes.js`
- `public/farm.html`
- `public/app.js`

## CSS

Файл `public/style-additions.css` не нужно подключать отдельно. Открой его и вставь содержимое в конец твоего `public/style.css`.

## После загрузки

1. Перезапусти сервер.
2. В Twitch выполни `!синкферма`, чтобы подтянуть `farm_data_buildings` и остальные конфиги.
3. Открой `/farm` и проверь блок `🏗 Здания`.

## Важно

Сайт по-прежнему тратит только SQLite-копии балансов:

- `farm_balance`
- `upgrade_balance`
- `parts`

WizeBot-валюта пока не списывается обратно. Это сделаем позже отдельным безопасным payment bridge.
