# README_ADMIN_ALL_FARMERS_TAB_AND_DELETE_FARMER

Safe patch for admin panel farmers list.

## What changed
- Added a new admin tab: `Все фермеры`.
- The tab shows all farmers currently stored on the site.
- Added sorting:
  - by farm level
  - alphabetically
- Each farmer row shows index/total, login, level, farm balance, and parts.
- Clicking a farmer opens that player in the compact admin editor.
- Added `Удалить фермера` button that deletes the player from the site farmers list instead of only resetting balances.

## Backend
- Added `GET /api/admin/farmers?sort=level_desc|alpha_asc`
- Added `POST /api/admin/delete-farmer`

## Files changed
- `public/farm.html`
- `public/js/10k-admin-unified-editor.js`
- `public/css/07-admin-unified-editor.css`
- `routes/adminRoutes.js`

## Safety
- Chat files were not touched.
- Farm gameplay logic was not touched.
- Realtime/market/WizeBot logic was not touched.
- Only admin panel UI + admin routes were changed.
