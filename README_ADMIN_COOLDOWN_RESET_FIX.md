// WizeBot command: !синкферма
// Назначение: безопасно отправляет старую WizeBot-ферму nico_moose на сайт в SQLite.
// ВАЖНО: замени BRIDGE_SECRET на значение из переменной сайта WIZEBOT_BRIDGE_SECRET.
// ВАЖНО: если в WizeBot нет fetch(), смотри fallback ниже в README.

let user = (JS.datas('nick') || JS.wizebot.command.user_name() || '').toLowerCase();
let displayName = JS.datas('display_name') || JS.wizebot.command.display_name() || user;

if (user !== 'nico_moose') {
  JS.wizebot.send_chat_message(`❌ ${displayName}, sync доступен только Nico_Moose.`);
  JS.utils.stop();
}

const BRIDGE_URL = 'https://farm-moose.bothost.tech/bridge/wizebot-sync';
let SECRET = "moose_super_secret_2026";

function readVar(key, fallback) {
  let val = JS.wizebot.get_var(key);
  if (val === null || val === undefined || val === '') return fallback;
  return val;
}

let farmRaw = readVar('farm_' + user, '{}');
let farm = {};
try { farm = JSON.parse(farmRaw); } catch (_) { farm = {}; }

let payload = {
  secret: BRIDGE_SECRET,
  login: user,
  display_name: displayName,
  farm: farm,
  farm_balance: parseInt(readVar('farm_virtual_balance_' + user, '0'), 10) || 0,
  twitch_balance: parseInt(JS.wizebot.call_tag('currency', ['get', user]) || '0', 10) || 0,
  upgrade_balance: parseInt(readVar('farm_upgrade_balance_' + user, '0'), 10) || 0,
  total_income: parseInt(readVar('farm_total_income_' + user, '0'), 10) || 0,
  last_collect_at: parseInt(readVar('farm_last_' + user, '0'), 10) || 0,
  license_level: parseInt(readVar('farm_license_' + user, '0'), 10) || 0,
  protection_level: parseInt(readVar('farm_protection_level_' + user, '0'), 10) || 0,
  raid_power: parseInt(readVar('farm_raid_power_' + user, '0'), 10) || 0,
  turret: readVar('farm_defense_building_' + user, '{}')
};

async function run() {
  try {
    let res = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-wizebot-bridge-secret': BRIDGE_SECRET
      },
      body: JSON.stringify(payload)
    });

    let text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) {}

    if (!res.ok || !data.ok) {
      JS.wizebot.send_chat_message(`❌ ${displayName}, sync error: ${data.error || res.status}`);
      JS.utils.stop();
    }

    JS.wizebot.send_chat_message(`✅ ${displayName}, ферма синхронизирована с сайтом: ур.${data.imported.level}, 💰${data.imported.twitch_balance}, 🌾${data.imported.farm_balance}, 💎${data.imported.upgrade_balance}, 🔧${data.imported.parts}`);
  } catch (e) {
    JS.wizebot.send_chat_message(`❌ ${displayName}, sync failed: ${e.message || e}`);
  }
}

run();
