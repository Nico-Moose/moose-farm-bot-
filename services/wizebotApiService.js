const { config, isWebMasterLogin } = require('../config');
const { triggerWizebotWebMasterApply } = require('./twitchChatService');

const WIZEBOT_API_BASE = 'https://wapi.wizebot.tv/api';

function parseMaybeJson(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

function assertReadApiKey() {
  if (!config.wizebot?.apiKey) throw new Error('WIZEBOT_API_KEY is missing');
}

function assertWriteApiKey() {
  if (!config.wizebot?.apiKeyRw) throw new Error('WIZEBOT_API_KEY_RW is missing');
}

async function parseApiResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, raw: text, status: res.status };
  }
}

async function getCustomDataRaw(key) {
  assertReadApiKey();
  const url = `${WIZEBOT_API_BASE}/custom-data/${config.wizebot.apiKey}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url);
  return parseApiResponse(res);
}

async function getCustomDataFirst(keys, fallback = null) {
  const errors = [];
  for (const key of keys) {
    const data = await getCustomDataRaw(key);
    if (data.success) {
      return { key, value: parseMaybeJson(data.val), found: true };
    }
    errors.push({ key, data });
  }
  return { key: keys[0], value: fallback, found: false, errors };
}

async function setCustomData(key, value) {
  assertWriteApiKey();

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(serialized);

  const attempts = [
    {
      name: 'path_value_post',
      url: `${WIZEBOT_API_BASE}/custom-data/${config.wizebot.apiKeyRw}/set/${encodedKey}/${encodedValue}`,
      options: { method: 'POST' }
    },
    {
      name: 'query_value_post',
      url: `${WIZEBOT_API_BASE}/custom-data/${config.wizebot.apiKeyRw}/set/${encodedKey}/1?DATA_VAL=${encodedValue}`,
      options: { method: 'POST' }
    },
    {
      name: 'query_value_form_post',
      url: `${WIZEBOT_API_BASE}/custom-data/${config.wizebot.apiKeyRw}/set/${encodedKey}/1`,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `DATA_VAL=${encodedValue}`
      }
    }
  ];

  const errors = [];
  for (const attempt of attempts) {
    const res = await fetch(attempt.url, attempt.options);
    const data = await parseApiResponse(res);
    if (res.ok && data.success) {
      return { ...data, attempt: attempt.name };
    }
    errors.push({ attempt: attempt.name, status: res.status, data });
  }

  const err = new Error(`WizeBot custom-data set failed for ${key}`);
  err.details = errors;
  throw err;
}

async function setCurrencyValue(login, amount) {
  assertWriteApiKey();
  const viewer = normalizeLogin(login);
  const safeAmount = Math.max(0, Number(amount || 0) || 0);
  const url = `${WIZEBOT_API_BASE}/currency/${config.wizebot.apiKeyRw}/action/set/${encodeURIComponent(viewer)}/${encodeURIComponent(String(safeAmount))}`;
  const res = await fetch(url, { method: 'POST' });
  const data = await parseApiResponse(res);
  if (!res.ok || !data.success || data.action_success === false) {
    const err = new Error(`WizeBot currency set failed for ${viewer}`);
    err.details = data;
    throw err;
  }
  return data;
}

function buildFarmState(profile) {
  const login = normalizeLogin(profile?.login);
  const farm = profile?.farm && typeof profile.farm === 'object' ? JSON.parse(JSON.stringify(profile.farm)) : {};
  farm.level = Number(profile?.level ?? farm.level ?? 0) || 0;
  farm.resources = farm.resources || {};
  farm.resources.parts = Math.max(0, Number(profile?.parts ?? farm.resources.parts ?? 0) || 0);
  farm.buildings = farm.buildings || {};

  return {
    login,
    farm,
    farm_balance: Math.max(0, Number(profile?.farm_balance ?? 0) || 0),
    twitch_balance: Math.max(0, Number(profile?.twitch_balance ?? 0) || 0),
    upgrade_balance: Math.max(0, Number(profile?.upgrade_balance ?? 0) || 0),
    total_income: Math.max(0, Number(profile?.total_income ?? 0) || 0),
    last_collect_at: Number(profile?.last_collect_at ?? 0) || 0,
    license_level: Math.max(0, Number(profile?.license_level ?? 0) || 0),
    protection_level: Math.max(0, Number(profile?.protection_level ?? 0) || 0),
    raid_power: Math.max(0, Number(profile?.raid_power ?? 0) || 0),
    turret: profile?.turret && typeof profile.turret === 'object' ? profile.turret : {}
  };
}

function isWebMasterProfile(profile) {
  return isWebMasterLogin(profile?.login);
}

async function syncProfileToWizebot(profile) {
  if (!profile?.login) throw new Error('profile_login_missing');

  const state = buildFarmState(profile);
  const rawTasks = [
    ['farm_' + state.login, state.farm],
    ['farm_virtual_balance_' + state.login, String(state.farm_balance)],
    ['farm_upgrade_balance_' + state.login, String(state.upgrade_balance)],
    ['farm_total_income_' + state.login, String(state.total_income)],
    ['farm_last_' + state.login, String(state.last_collect_at)],
    ['farm_license_' + state.login, String(state.license_level)],
    ['farm_protection_level_' + state.login, String(state.protection_level)],
    ['farm_raid_power_' + state.login, String(state.raid_power)],
    ['farm_defense_building_' + state.login, state.turret]
  ];

  const results = [];
  const syncedKeys = [];
  const skippedKeys = [];
  const failedKeys = [];

  for (const [key, value] of rawTasks) {
    try {
      await setCustomData(key, value);
      syncedKeys.push(key);
      results.push({ key, ok: true });
    } catch (error) {
      failedKeys.push({ key, message: error.message, details: error.details || null });
      results.push({ key, ok: false, message: error.message, details: error.details || null });
    }
  }

  try {
    await setCurrencyValue(state.login, state.twitch_balance);
    syncedKeys.push('currency');
    results.push({ key: 'currency', ok: true });
  } catch (error) {
    failedKeys.push({ key: 'currency', message: error.message, details: error.details || null });
    results.push({ key: 'currency', ok: false, message: error.message, details: error.details || null });
  }

  let chatApply = null;
  try {
    chatApply = await triggerWizebotWebMasterApply(state.login);
    results.push({ key: 'wizebot_js_set_var_chat_trigger', ok: !!chatApply.ok, details: chatApply });
    if (chatApply.ok) syncedKeys.push('wizebot_js_set_var_chat_trigger');
    else failedKeys.push({ key: 'wizebot_js_set_var_chat_trigger', message: chatApply.error || chatApply.reason || 'chat_trigger_failed', details: chatApply });
  } catch (error) {
    chatApply = { ok: false, error: error.message };
    failedKeys.push({ key: 'wizebot_js_set_var_chat_trigger', message: error.message, details: error.details || null });
    results.push({ key: 'wizebot_js_set_var_chat_trigger', ok: false, message: error.message, details: error.details || null });
  }

  const syncedAt = Date.now();
  const ok = failedKeys.length === 0;

  return { ok, login: state.login, syncedAt, keys: syncedKeys, skippedKeys, failedKeys, chatApply, results };
}

async function syncProfileToWizebotIfNeeded(profile) {
  if (!isWebMasterProfile(profile)) {
    return { ok: false, skipped: true, reason: 'not_web_master_profile' };
  }
  return syncProfileToWizebot(profile);
}

async function getWizebotFarmDataByLogin(login, options = {}) {
  const normalized = normalizeLogin(login);
  if (!normalized) throw new Error('missing_login');

  const exact = (prefix) => `${prefix}${normalized}`;
  const variants = (prefix) => [exact(prefix)];

  const [farmResult, farmBalanceResult, upgradeBalanceResult, totalIncomeResult, lastCollectResult, licenseResult, protectionResult, raidPowerResult, turretResult] = await Promise.all([
    getCustomDataFirst(variants('farm_'), {}),
    getCustomDataFirst(variants('farm_virtual_balance_'), 0),
    getCustomDataFirst(variants('farm_upgrade_balance_'), 0),
    getCustomDataFirst(variants('farm_total_income_'), 0),
    getCustomDataFirst(variants('farm_last_'), 0),
    getCustomDataFirst(variants('farm_license_'), 0),
    getCustomDataFirst(variants('farm_protection_level_'), 0),
    getCustomDataFirst(variants('farm_raid_power_'), 0),
    getCustomDataFirst(variants('farm_defense_building_'), {})
  ]);

  const farm = farmResult.value && typeof farmResult.value === 'object' ? farmResult.value : {};

  return {
    login: normalized,
    farm,
    farm_balance: Number(farmBalanceResult.value || 0),
    upgrade_balance: Number(upgradeBalanceResult.value || 0),
    total_income: Number(totalIncomeResult.value || 0),
    last_collect_at: Number(lastCollectResult.value || 0),
    license_level: Number(licenseResult.value || 0),
    protection_level: Number(protectionResult.value || 0),
    raid_power: Number(raidPowerResult.value || 0),
    turret: turretResult.value && typeof turretResult.value === 'object' ? turretResult.value : {},
    twitch_balance: Number(options.currentTwitchBalance || 0),
    configs: options.currentConfigs || {},
    globals: options.currentGlobals || {},
    foundKeys: {
      farm: farmResult.key,
      farm_balance: farmBalanceResult.key,
      upgrade_balance: upgradeBalanceResult.key,
      total_income: totalIncomeResult.key,
      last_collect_at: lastCollectResult.key,
      license_level: licenseResult.key,
      protection_level: protectionResult.key,
      raid_power: raidPowerResult.key,
      turret: turretResult.key
    }
  };
}

async function getNicoMooseFarmData() {
  return getWizebotFarmDataByLogin('nico_moose');
}

module.exports = {
  normalizeLogin,
  getCustomDataRaw,
  getCustomDataFirst,
  getWizebotFarmDataByLogin,
  getNicoMooseFarmData,
  setCustomData,
  setCurrencyValue,
  buildFarmState,
  isWebMasterProfile,
  syncProfileToWizebot,
  syncProfileToWizebotIfNeeded
};
