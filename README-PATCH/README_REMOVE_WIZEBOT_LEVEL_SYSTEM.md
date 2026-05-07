# PATCH: remove WizeBot LVL system traces

Что удалено из кода:
- блок `WizeBot LVL` на главной странице;
- bridge `/bridge/wizebot-level-push`;
- функцию `applyWizebotLevelByLogin`;
- поля WizeBot LVL из API-ответа `/api/farm/state`;
- запись/обновление WizeBot LVL-полей в `userService`;
- автодобавление колонок WizeBot LVL в `dbService`;
- CSS для карточки WizeBot LVL.

Изменённые файлы:
- `services/dbService.js`
- `services/userService.js`
- `routes/apiRoutes.js`
- `routes/bridgeRoutes.js`
- `public/js/01-core-main.js`
- `js/01-core-main.js`
- `public/css/02-layout-tabs-ui.css`

Важно:
- существующие старые колонки в SQLite физически не удаляются, чтобы не рисковать БД;
- код их больше не читает, не пишет и не отдаёт во фронт;
- если в WizeBot была команда `!сайтлвл`, её можно удалить вручную в WizeBot.

Опционально можно удалить старые README-файлы прошлых патчей:
- `README-PATCH/README_WIZEBOT_LEVEL_BRIDGE_CARD.md`
- `README-PATCH/README_WIZEBOT_LEVEL_BRIDGE_HOTFIX.md`
