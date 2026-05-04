# OFFCOLLECT estimateHourlyIncome import fix

## Что исправлено
- Исправлен `ReferenceError: estimateHourlyIncome is not defined` в `services/farm/offCollectService.js`.
- Возвращён корректный импорт `estimateHourlyIncome` из `incomeService`.

## Почему ломалось
После рефактора в `offCollectService` остался вызов `estimateHourlyIncome(profile)`, но сам импорт был заменён на другие функции и больше не содержал `estimateHourlyIncome`. Из-за этого `/farm/offcollect` падал на сервере и на фронте оставалось сообщение про выполняющееся действие.

## Что не трогалось
- рынок
- журнал
- админка
- CSS
- остальная логика доходов
