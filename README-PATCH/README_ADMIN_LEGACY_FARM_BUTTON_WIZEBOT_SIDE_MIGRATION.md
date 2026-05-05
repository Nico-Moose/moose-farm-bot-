# README_ADMIN_LEGACY_FARM_BUTTON_WIZEBOT_SIDE_MIGRATION

Safe patch for admin legacy `!ферма` migration by button.

## Why
Some old WizeBot farm data exists for `JS.wizebot.get_var("farm_" + login)` and is visible to the old `!ферма` command, but is not reliably visible to the website through WizeBot custom-data API.

## What changed on the website
- `services/twitchChatService.js`
  - added `triggerWizebotLegacyFarmMigration(login)`.
  - it sends `!сайтмигрферма <login>` to Twitch chat through the existing site chat bot.
- `routes/adminRoutes.js`
  - admin `import-legacy-farm` still tries the direct WizeBot API path first.
  - if direct API import fails, it triggers the WizeBot-side migration command and waits for `/bridge/farm-v2-push` to update the profile.

## New WizeBot command file
- `wizebot_commands/!сайтмигрферма.txt`

Create this command in WizeBot. It reads the old legacy vars directly with `JS.wizebot.get_var`, creates `farm_v2_<login>`, and pushes the result to the site through `/bridge/farm-v2-push`.

## Important setup
If your website Twitch chat bot is not `nico_moose`, edit this line in the WizeBot command:

```js
const ALLOWED_CALLERS = ['nico_moose'];
```

Add the bot login, for example:

```js
const ALLOWED_CALLERS = ['nico_moose', 'your_bot_login'];
```

## Files changed/added
- `routes/adminRoutes.js`
- `services/twitchChatService.js`
- `wizebot_commands/!сайтмигрферма.txt`

## Safety notes
- No frontend changes.
- No `farm.html` changes.
- No chat embed changes.
- No admin layout/CSS changes.
- No market/realtime/buildings UI changes.
