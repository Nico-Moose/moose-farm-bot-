# Safe patch: lite profile lists for raid/top

Что изменено:
- Для `/farm/raid` больше не используется полный `listProfiles()`.
- Для `/farm/top` больше не используется полный `listProfiles()`.
- Добавлены облегчённые выборки:
  - `listRaidCandidateProfiles()`
  - `listTopProfilesLite()`

Что это даёт:
- меньше данных читается из SQLite;
- меньше JSON парсится на рейдах и топах;
- логика рейдов и топов не меняется;
- UI не меняется.

Что не трогалось:
- рынок;
- журнал;
- здания;
- CSS;
- WizeBot sync.
