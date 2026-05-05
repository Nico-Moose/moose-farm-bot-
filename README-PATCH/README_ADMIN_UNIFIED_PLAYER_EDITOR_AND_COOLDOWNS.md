# README_ADMIN_UNIFIED_PLAYER_EDITOR_AND_COOLDOWNS

Safe patch for admin panel convenience.

## What changed
- Admin panel now loads the current admin profile by default (`nico_moose` / current admin login).
- Removed top tabs `Баланс` and `Уровни` from the visible admin tabs.
- Player editing is now a single unified card under the nickname field.
- Editable values include level, farm balance, bonus balance, parts, license, raid power, protection, total income and turret values.
- Buildings are editable directly from the same player card.
- Added quick per-player buttons for case, raid and offcollect cooldown reset.
- Added dangerous/global buttons for all-player GAMUS reset and all-player cooldown resets.

## Files changed
- `public/farm.html`
- `public/style.css`
- `public/css/07-admin-unified-editor.css`
- `public/js/10k-admin-unified-editor.js`
- `routes/adminRoutes.js`

## Safety notes
- No changes to farm gameplay UI, market, buildings tab, realtime or WizeBot sync contracts.
- Twitch ordinary gold is still not editable here because WizeBot currency remains the source of truth.
- Mass actions are placed in `Опасное` and protected by browser confirmation.
