WizeBot LVL bridge + site profile card

Что сделано
- добавлены поля WizeBot LVL в farm_profiles
- сайт теперь умеет показывать блок WizeBot LVL под карточкой профиля
- добавлен bridge endpoint /bridge/wizebot-level-push

Как использовать
1. Создай в WizeBot JS-команду, например !сайтлвл [login]
2. Команда должна читать level/rank/exp/next_exp/custom_rank и делать urlcall на:
   /bridge/wizebot-level-push?login=<login>&secret=<secret>&level=<level>&rank=<rank>&exp=<exp>&next_exp=<next_exp>&custom_rank=<custom_rank>
3. После этого сайт покажет данные в карточке профиля.

Важно
- Кнопка ↻ Обновить на сайте перечитывает уже сохранённые данные сайта.
- Без WizeBot bridge-команды новые данные уровня на сайт сами не попадут.
- В публичной API WizeBot не найден отдельный HTTP endpoint для JS level tags, поэтому используется bridge-подход.
