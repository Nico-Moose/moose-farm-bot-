# stage1-20-case-history-button-ui

Что сделано:
- в финальном рендере блока `Кейс / GAMUS / оффсбор` заменён старый `<details><summary>Последние кейсы</summary>` на нормальную красивую кнопку `📜 Последние кейсы`;
- кнопка открывает уже существующую историю кейсов через `loadCaseHistory()`; если этот helper недоступен, используется безопасный fallback на `showCaseHistoryModal(cs.history || [])`.

Что изменено:
- `public/js/10f-history-raid-case-offcollect.js`
- `README-PATCH/stage1-20-case-history-button-ui.md`

Что не менялось:
- логика кейсов;
- API;
- награды, кулдаун, множитель;
- рынок, здания, рейды.
