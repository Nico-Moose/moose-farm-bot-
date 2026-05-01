# WEB MASTER TEST SYNC

Что добавлено:
- сайт стал главным источником прогресса для логинов из `WEB_MASTER_USERS`
- по умолчанию включён только `nico_moose`
- после успешных действий на сайте профиль пушится обратно в WizeBot
- пуш обновляет:
  - `farm_<login>`
  - `farm_virtual_balance_<login>`
  - `farm_upgrade_balance_<login>`
  - `farm_total_income_<login>`
  - `farm_last_<login>`
  - `farm_license_<login>`
  - `farm_protection_level_<login>`
  - `farm_raid_power_<login>`
  - `farm_defense_building_<login>`
  - обычную валюту через `currency SET`
- повторный импорт из WizeBot блокируется после первого успешного website -> WizeBot push, чтобы не затереть прогресс

Что нужно в `.env`:
- `WIZEBOT_API_KEY_RW`
- `WEB_MASTER_USERS=nico_moose`

Как тестировать:
1. Импортируй себя один раз из WizeBot в сайт.
2. Сделай действие на сайте: upgrade / collect / buy building / market / license.
3. Проверь ответ API: поле `wizebotSync`.
4. Проверь в чате `!мани` и старые команды.

Важно:
- остальные игроки не затронуты, пока их логины не добавлены в `WEB_MASTER_USERS`.
