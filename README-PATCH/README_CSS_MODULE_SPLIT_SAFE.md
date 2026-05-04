# CSS module split safe patch

Что сделано:
- `public/style.css` стал точкой входа с `@import`.
- Основной CSS разнесён по файлам в `public/css/`.
- Порядок правил сохранён 1 в 1, логика и JS не менялись.
- `farm.html`, `app.js`, рынок, здания, админка и API не трогались.

Важно:
- Нужно заменить весь патч целиком, включая папку `public/css`.
- Если заменить только `public/style.css` без папки `public/css`, стили не загрузятся.

Файлы:
- `public/style.css`
- `public/css/01-base-and-legacy.css`
- `public/css/02-layout-tabs-ui.css`
- `public/css/03-popups-market-buildings.css`
- `public/css/04-big-polish-market-history.css`
- `public/css/05-admin-panel.css`
- `public/css/06-final-fixes-responsive.css`
