# Admin Legacy Farm Import Patch

Дата: 2026-05-03

Что сделано:
- Добавлен отдельный backend route `POST /api/admin/import-legacy-farm`.
- Кнопка админки теперь переносит старую `!ферма` из WizeBot в сайт/farm_v2.
- Existing `sync-from-wizebot` тоже переключён на этот перенос, чтобы старая кнопка/кэш фронта не вызывали неправильную операцию.
- Если игрока нет на сайте, профиль создаётся автоматически с техническим `twitch_id = legacy:<login>`.
- Перед импортом создаётся backup.
- После импорта профиль сохраняется на сайте и сразу пушится обратно в WizeBot как новая `farm_v2` модель.

Источник данных при импорте:
- `farm_<login>`
- `farm_virtual_balance_<login>`
- `farm_upgrade_balance_<login>`
- `farm_total_income_<login>`
- `farm_last_<login>`
- `farm_license_<login>`
- `farm_protection_level_<login>`
- `farm_raid_power_<login>`
- `farm_defense_building_<login>`

Важно:
- `!v2sync` — это сайт → WizeBot.
- Эта кнопка админки — old WizeBot `!ферма` → сайт/farm_v2.
- README лежит в `README-PATCH`.
