# Stage 1.6 - farm read speed patch (history/top)

## Что изменено

Точечный non-game speed-patch только на чтение, без изменения API-контрактов и без касания рынка / core-геймплея.

Изменённые файлы:
- `routes/apiRoutes.js`
- `services/userService.js`

## Что сделано

### 1) `/api/farm/history`
Добавлен короткий in-memory cache на 1200 мс по ключу:
- `twitchUser.id`
- `type`
- `limit`

Это снижает лишние повторные чтения `farm_events`, когда фронт быстро повторяет одинаковый запрос истории.

Важно:
- кэш только краткоживущий;
- формат ответа не менялся;
- после farm POST уже существующий `invalidateFarmCache(twitchId)` очищает ключи вида `farm:${twitchId}:*`, значит история не должна залипать после игровых действий.

### 2) `/api/farm/top`
Оставлен существующий response-cache по `days`, но добавлен общий short-cache для lite-профилей:
- ключ: `farm:top:profiles`
- TTL: 5000 мс

Зачем:
- вкладка топов может запросить `1 / 7 / 14` дней подряд;
- раньше каждый cache miss заново делал `listTopProfilesLite()` и полную нормализацию lite-профилей;
- теперь за короткий интервал один и тот же набор lite-профилей переиспользуется между этими запросами.

Важно:
- расчёты топов не менялись;
- response JSON не менялся;
- `invalidateFarmCache()` уже сбрасывает префикс `farm:top:`, значит short-cache топов тоже очищается после farm POST.

### 3) `services/userService.js`
Для `listTopProfilesLite()` добавлен reuse prepared statement вместо повторного `db.prepare(...)` на каждый вызов.

## Что не менялось
- рынок;
- здания;
- рейды;
- кейсы;
- farm_v2 / WizeBot sync;
- UI и тексты.

## Риск
Низкий.
Патч только ускоряет чтение и не меняет бизнес-логику.

## Базовая проверка
- `node --check routes/apiRoutes.js`
- `node --check services/userService.js`
