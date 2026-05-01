# Hotfix: сайт → WizeBot ферма через JS.set_var

Проблема: `currency SET` обновлял `!мани`, но `!ферма` оставалась старой, потому что старые WizeBot-команды читают `JS.wizebot.get_var('farm_' + user)`, а API `custom-data SET` не всегда обновляет эти JS-переменные так, как нужно.

Что добавлено:

1. Новый серверный endpoint:
   - `GET /bridge/web-master-state?login=nico_moose&secret=...`
   - отдаёт точное состояние сайта для WizeBot-переменных.

2. Новый WizeBot JS command:
   - файл `wizebot_commands/!сайтфермапуш.txt`
   - команда забирает состояние сайта и делает `JS.wizebot.set_var(...)` для:
     - `farm_<login>`
     - `farm_virtual_balance_<login>`
     - `farm_upgrade_balance_<login>`
     - `farm_total_income_<login>`
     - `farm_last_<login>`
     - `farm_license_<login>`
     - `farm_protection_level_<login>`
     - `farm_raid_power_<login>`
     - `farm_defense_building_<login>`
     - добавляет login в `farm_players`

3. Сайт после каждого действия web-master пользователя отправляет в Twitch chat:
   - `!сайтфермапуш nico_moose`

4. `currency SET` остаётся отдельно, поэтому `!мани` продолжает обновляться через API.

## Что нужно сделать после установки

1. Залить обновлённый сайт и перезапустить Node.
2. В WizeBot создать/обновить JS-команду `!сайтфермапуш` содержимым файла:
   - `wizebot_commands/!сайтфермапуш.txt`
3. Внутри команды проверить:
   - `BASE_URL = 'https://farm-moose.bothost.tech'`
   - `SECRET = 'moose_super_secret_2026'`
   Они должны совпадать с сайтом и `.env`.
4. Если Twitch-бот сайта называется иначе, добавь его login в массив `allowed` в команде.

## Тест

1. На сайте нажми `Улучшить +1`.
2. Подожди 1-3 секунды.
3. В чате введи `!ферма`.
4. Уровень должен совпасть с сайтом.
5. Для ручной проверки можно в чате выполнить:
   - `!сайтфермапуш nico_moose debug`

После этого `!ферма`, `!рейд`, `!турель` и другие старые команды должны читать актуальные значения сайта.
