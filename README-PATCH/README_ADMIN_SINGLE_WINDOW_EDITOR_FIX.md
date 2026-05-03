# Admin Single Window Editor Fix

Дата: 2026-05-03

Что исправлено:
- Backup / Restore больше не появляется отдельным вторым окном справа.
- Backup / Restore перенесён во вкладку админ-панели `Backup`.
- Просмотр профиля игрока больше не открывает отдельную модалку поверх админки.
- Профиль игрока теперь показывается в этом же окне админки.
- Показанные поля игрока можно редактировать прямо в карточке:
  - уровень
  - farm_balance
  - upgrade_balance
  - parts
  - license_level
  - raid_power
  - protection_level
  - turret_level
  - turret_chance
- Добавлен серверный endpoint `POST /api/admin/player/set-field`.
- Перед изменением поля создаётся admin backup.
- В корне проекта README лежит в папке `README-PATCH`.

Что ещё можно сделать следующим проходом:
- Редактирование уровней зданий прямо из профиля.
- Редактирование caseStats / raidLogs / cooldown прямо из профиля.
- Редактирование WizeBot currency через отдельный bridge, если нужно менять именно `!money`, а не только сайт.
