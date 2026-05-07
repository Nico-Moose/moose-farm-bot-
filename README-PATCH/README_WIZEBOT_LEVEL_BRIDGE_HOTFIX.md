# WizeBot level bridge hotfix

- exported `applyWizebotLevelByLogin` from `services/userService.js`
- `/bridge/wizebot-level-push` now accepts both direct query params and `payload=` JSON from WizeBot command
- fixes `⚠️ не удалось синхронизировать WizeBot LVL ...` and makes the profile block populate after successful push
