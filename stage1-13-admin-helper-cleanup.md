# Stage 1.13 — local helper cleanup inside `adminRoutes.js`

Что сделано:
- добавлен локальный helper `getBodyLogin(req, field = 'login')` для повторяющейся нормализации `req.body.login` / `oldLogin` / `newLogin`;
- helper применён только в нижнем локальном блоке `adminRoutes.js`, без массовой замены по всему файлу;
- удалено дублирующееся второе объявление `restoreFarmBackup()`.

Что не менялось:
- URL и ответы API;
- danger/backups маршруты не выносились;
- рынок, игровые механики, WizeBot sync не затрагивались.

Почему это safe:
- чистка локальная и механическая;
- используется та же нормализация логина, что была inline;
- поведение `restore-backup` остаётся на первой, более безопасной реализации `restoreFarmBackup()`.
