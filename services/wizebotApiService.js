const { config } = require('../config');

const WIZEBOT_API_BASE = 'https://wapi.wizebot.tv/api';

function parseMaybeJson(value) {
  if (value === null || value === undefined) return null;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function getCustomData(key) {
  if (!config.wizebot?.apiKey) {
    throw new Error('WIZEBOT_API_KEY is missing');
  }

  const url = `${WIZEBOT_API_BASE}/custom-data/${config.wizebot.apiKey}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.success) {
    throw new Error(`WizeBot custom-data get failed: ${key}`);
  }

  return parseMaybeJson(data.val);
}

async function getNicoMooseFarmData() {
  const user = 'nico_moose';

  const [farm, farmBalance, upgradeBalance] = await Promise.all([
    getCustomData(`farm_${user}`),
    getCustomData(`farm_virtual_balance_${user}`),
    getCustomData(`farm_upgrade_balance_${user}`)
  ]);

  return {
    farm,
    farm_balance: Number(farmBalance || 0),
    upgrade_balance: Number(upgradeBalance || 0)
  };
}

module.exports = {
  getCustomData,
  getNicoMooseFarmData
};
