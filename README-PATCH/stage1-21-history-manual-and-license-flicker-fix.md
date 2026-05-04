# stage1-21-history-manual-and-license-flicker-fix

Что исправлено:
- вход во вкладку `История / журнал` больше не запускает автоматический `loadHistory()`; история теперь грузится только кнопкой `Обновить журнал` или сменой фильтра типа;
- общий `loadMe()` больше не дёргает историю скрыто после обычных refresh/render;
- убран лишний второй full-refresh после instant-upgrade для рейд-силы / защиты / турели, из-за которого на главной мог мигать блок лицензий и был лишний двойной перерендер.

Что изменено:
- `public/js/10b-case-tabs-loader.js`
- `public/js/10d-live-refresh-stale.js`
- `public/js/10e-instant-upgrade-refresh.js`
- `README-PATCH/stage1-21-history-manual-and-license-flicker-fix.md`

Что не менялось:
- рынок;
- здания;
- логика истории;
- API;
- рейды/турель на сервере.
