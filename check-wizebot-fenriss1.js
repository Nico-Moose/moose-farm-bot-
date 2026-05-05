require('dotenv').config();

const API_KEY =
  process.env.WIZEBOT_API_KEY ||
  process.env.WIZEBOT_API_KEY_RW ||
  'PASTE_YOUR_WIZEBOT_API_KEY_HERE';

const LOGIN = 'fenriss1';

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'moose-farm-wizebot-check'
    }
  });

  const text = await res.text();
  let data = null;

  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: res.ok,
    status: res.status,
    data
  };
}

async function checkCustomData(key) {
  const url = `https://wapi.wizebot.tv/api/custom-data/${encodeURIComponent(API_KEY)}/get/${encodeURIComponent(key)}`;
  const result = await getJson(url);

  return {
    type: 'custom-data',
    key,
    url,
    status: result.status,
    ok: result.ok,
    success: !!(result.data && result.data.success),
    value: result.data && Object.prototype.hasOwnProperty.call(result.data, 'val') ? result.data.val : null,
    full: result.data
  };
}

async function checkCurrency(login) {
  const urls = [
    `https://wapi.wizebot.tv/api/currency/${encodeURIComponent(API_KEY)}/get/${encodeURIComponent(login)}`,
    `https://wapi.wizebot.tv/api/currency/${encodeURIComponent(API_KEY)}/action/get/${encodeURIComponent(login)}`
  ];

  const results = [];

  for (const url of urls) {
    const result = await getJson(url);
    results.push({
      type: 'currency',
      login,
      url,
      status: result.status,
      ok: result.ok,
      full: result.data
    });
  }

  return results;
}

(async () => {
  const keys = [
    `farm_${LOGIN}`,
    `farm_virtual_balance_${LOGIN}`,
    `farm_upgrade_balance_${LOGIN}`,
    `farm_total_income_${LOGIN}`,
    `farm_last_${LOGIN}`,
    `farm_license_${LOGIN}`,
    `farm_protection_level_${LOGIN}`,
    `farm_raid_power_${LOGIN}`,
    `farm_defense_building_${LOGIN}`
  ];

  console.log(`\n=== CUSTOM DATA CHECK FOR ${LOGIN} ===\n`);

  for (const key of keys) {
    const result = await checkCustomData(key);

    console.log(`KEY: ${key}`);
    console.log(`  HTTP: ${result.status}`);
    console.log(`  success: ${result.success}`);
    console.log(`  has val: ${result.value !== null}`);

    if (typeof result.value === 'string') {
      console.log(`  val preview: ${result.value.slice(0, 180)}`);
    } else {
      console.log(`  val:`, result.value);
    }

    console.log('');
  }

  console.log(`\n=== CURRENCY CHECK FOR ${LOGIN} ===\n`);

  const currencyResults = await checkCurrency(LOGIN);
  for (const item of currencyResults) {
    console.log(`URL: ${item.url}`);
    console.log(`  HTTP: ${item.status}`);
    console.log(`  body:`, item.full);
    console.log('');
  }
})();
