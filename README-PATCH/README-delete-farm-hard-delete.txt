Patch: кнопка «Удалить ферму игрока» переведена на полное удаление как у кнопки «Удалить фермера».

Что изменено:
1. routes/adminRoutes.js
- route POST /delete-farm больше не делает локальный reset farm_profiles
- теперь он работает как hard delete:
  - отправляет в чат !удалитьферму2 <login>
  - ждёт короткую паузу
  - удаляет запись из farm_profiles
- добавлены warning/message по результату триггера WizeBot

2. public/js/admin-panel.js
3. public/js/admin-panel-core.js
4. public/js/06-admin-history.js
- кнопка admin-delete-farm теперь шлёт delete-farmer вместо delete-farm

Зачем:
- чтобы удаление из карточки игрока и удаление из списка фермеров работали одинаково
- чтобы после удаления не оставались legacy vars в WizeBot
- чтобы игрок мог купить ферму заново через !купитьферму2

Риск:
- минимальный safe-patch
- другие кнопки и маршруты не затронуты
