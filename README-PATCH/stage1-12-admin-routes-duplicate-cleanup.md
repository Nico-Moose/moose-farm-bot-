# Stage 1.12 — adminRoutes.js duplicate cleanup (safe)

Что сделано:
- в `routes/adminRoutes.js` удалён дублирующийся второй `restoreFarmBackup()`;
- оставлена первая, более безопасная реализация, которая использует `deepCloneSafe()` и аккуратно сохраняет `adminBackups`.

Почему это safe:
- URL и маршруты не менялись;
- поведение `POST /api/admin/restore-backup` не менялось;
- `danger` и `backups` не выносились в отдельные модули;
- рынок, игровые механики и WizeBot sync не затронуты.

Что это убирает:
- лишний shadowing/переопределение helper-функции внутри `adminRoutes.js`;
- риск случайной правки не той версии `restoreFarmBackup()` в будущем.
