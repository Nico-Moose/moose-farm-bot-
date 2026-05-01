# Admin cooldown reset fix

Исправлено:
- reset GAMUS теперь сбрасывает `farm.lastGamusAt = 0`;
- reset cases теперь сбрасывает `farm.lastCaseAt = 0`;
- после сброса UI вызывает `loadMe()`, чтобы карточки обновились сразу.
