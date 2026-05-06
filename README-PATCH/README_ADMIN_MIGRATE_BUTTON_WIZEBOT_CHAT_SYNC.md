# PATCH: кнопка «Мигрферма»

## Что сделано
- В карточке игрока в админ-панели рядом с кнопкой `↻ Обновить` добавлена красная кнопка `🟥 Мигрферма`.
- Кнопка вызывает backend-route `POST /api/admin/trigger-legacy-migration`.
- Route отправляет в Twitch chat команду WizeBot-миграции через бота: `!сайтмигрферма <login>` по умолчанию.
- После отправки сайт ждёт обновление `last_wizebot_sync_at` и только потом возвращает успех.
- В статусе показывается сообщение `WizeBot данные синхронизированы: <login>`.

## Важно
- Команда берётся из `WIZEBOT_LEGACY_MIGRATION_COMMAND`.
- Если переменная не задана, используется `!сайтмигрферма`.
- Если нужна другая команда, например `!мигрферма`, задай в `.env`:
  - `WIZEBOT_LEGACY_MIGRATION_COMMAND=!мигрферма`

## Изменённые файлы
- `routes/adminRoutes.js`
- `public/js/10k-admin-unified-editor.js`
- `public/css/07-admin-unified-editor.css`
