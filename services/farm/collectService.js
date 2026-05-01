const { WIZEBOT } = require('./economyConfig');
const { collectIncome } = require('./incomeService');

module.exports = {
  COLLECT_COOLDOWN_MS: WIZEBOT.COLLECT_COOLDOWN_MS,
  collectFarm: collectIncome
};
