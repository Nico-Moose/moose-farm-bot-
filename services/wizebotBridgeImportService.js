const { getDb } = require('./dbService');
const { isWebMasterLogin } = require('../config');
const { getNextUpgrade, listBuildings } = require('./farmGameService');

function decodeHtml(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFEFF/g, '')
    .trim();
}

function extractJson(text) {
  const decoded = decodeHtml(text);
  const starts = [];

  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i] === '{') starts.push(i);
  }

  for (const start of starts) {
    for (let end = decoded.length - 1; end > start; end--) {
      if (decoded[end] !== '}') continue;

      const candidate = decoded.slice(start, end + 1).trim();

      try {
        const parsed = JSON.parse(candidate);

        if (parsed && typeof parsed === 'object' && parsed.login && parsed.farm) {
          return parsed;
        }
      } catch (_) {}
    }
  }

  throw new Error('Valid Moose JSON not found in longtext');
}

async function fetchLongtextJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Longtext fetch failed: ${res.status}`);
  }

  const html = await res.text();
  return extractJson(html);
}

function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value) {
  return Number(value || 0) || 0;
}

function normalizeTurret(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function makeWizebotTwitchId(login) {
  return `wizebot_${normalizeLogin(login)}`;
}

function loadProfileByTwitchId(twitchId) {
  return getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,
      f.level,
      f.farm_balance,
      f.twitch_balance,
      f.upgrade_balance,
      f.total_income,
      f.parts,
      f.last_collect_at,
      f.created_at,
      f.updated_at,
      f.farm_json,
      f.configs_json,
      f.license_level,
      f.protection_level,
      f.raid_power,
      f.turret_json,
      f.last_wizebot_sync_at
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE u.twitch_id = ?
  `).get(twitchId);
}

function ensureTwitchUserAndProfile({ login, displayName }) {
  const db = getDb();
  const normalizedLogin = normalizeLogin(login);
  const safeDisplayName = displayName || login || normalizedLogin;

  if (!normalizedLogin) {
    throw new Error('missing_login');
  }

  let userRow = db.prepare(`
    SELECT twitch_id
    FROM twitch_users
    WHERE LOWER(login) = ?
    LIMIT 1
  `).get(normalizedLogin);

  if (!userRow) {
    const twitchId = makeWizebotTwitchId(normalizedLogin);

    db.prepare(`
      INSERT INTO twitch_users (
        twitch_id,
        login,
        display_name,
        avatar_url
      )
      VALUES (?, ?, ?, ?)
    `).run(
      twitchId,
      normalizedLogin,
      safeDisplayName,
      null
    );

    userRow = { twitch_id: twitchId };
  } else {
    db.prepare(`
      UPDATE twitch_users
      SET
        login = ?,
        display_name = COALESCE(NULLIF(?, ''), display_name)
      WHERE twitch_id = ?
    `).run(
      normalizedLogin,
      safeDisplayName,
      userRow.twitch_id
    );
  }

  const profileRow = db.prepare(`
    SELECT twitch_id
    FROM farm_profiles
    WHERE twitch_id = ?
    LIMIT 1
  `).get(userRow.twitch_id);

  if (!profileRow) {
    const now = Date.now();

    db.prepare(`
      INSERT INTO farm_profiles (
        twitch_id,
        level,
        farm_balance,
        twitch_balance,
        upgrade_balance,
        total_income,
        parts,
        last_collect_at,
        created_at,
        updated_at,
        farm_json,
        configs_json,
        license_level,
        protection_level,
        raid_power,
        turret_json,
        last_wizebot_sync_at
      )
      VALUES (?, 0, 0, 0, 0, 0, 0, 0, ?, ?, '{}', '{}', 0, 0, 0, '{}', 0)
    `).run(
      userRow.twitch_id,
      now,
      now
    );
  }

  return userRow;
}

function importPayloadToSqlite(payload) {
  const login = normalizeLogin(payload.login);
  const displayName = payload.display_name || payload.login || login;

  if (!login) {
    return { ok: false, error: 'missing_login' };
  }

  const db = getDb();
  const now = Date.now();

  const farm = payload.farm || {};
  farm.resources = farm.resources || {};
  farm.buildings = farm.buildings || {};

  const configs = payload.configs || {};
  const globals = payload.globals || {};
  const turret = normalizeTurret(payload.turret);

  // WizeBot sends the shared market stock in globals. Keep it inside
  // farm_json so the site market does not reset to DEFAULT_STOCK after sync.
  farm.market = farm.market || {};
  if (globals.farm_parts_stock !== undefined) {
    farm.market.partsStock = normalizeNumber(globals.farm_parts_stock);
  }
  if (globals.farm_parts_sold_total !== undefined) {
    farm.market.totalSold = normalizeNumber(globals.farm_parts_sold_total);
  }
  if (globals.farm_parts_bought_total !== undefined) {
    farm.market.totalBought = normalizeNumber(globals.farm_parts_bought_total);
  }

  const userRow = ensureTwitchUserAndProfile({
    login,
    displayName
  });

  const previousProfile = loadProfileByTwitchId(userRow.twitch_id) || {};
  const hasTwitchBalance = Object.prototype.hasOwnProperty.call(payload, 'twitch_balance');

  const imported = {
    level: normalizeNumber(farm.level),
    farm_balance: normalizeNumber(payload.farm_balance),
    // Обычные монеты WizeBot из !мани. Если старый sync не прислал twitch_balance, не затираем сохранённое значение в 0.
    twitch_balance: hasTwitchBalance ? normalizeNumber(payload.twitch_balance) : normalizeNumber(previousProfile.twitch_balance),
    upgrade_balance: normalizeNumber(payload.upgrade_balance),
    total_income: normalizeNumber(payload.total_income),
    parts: normalizeNumber(farm.resources.parts),
    last_collect_at: normalizeNumber(payload.last_collect_at) || now,
    license_level: normalizeNumber(payload.license_level),
    protection_level: normalizeNumber(payload.protection_level),
    raid_power: normalizeNumber(payload.raid_power)
  };

  db.prepare(`
    UPDATE farm_profiles SET
      level = @level,
      farm_balance = @farm_balance,
      twitch_balance = @twitch_balance,
      upgrade_balance = @upgrade_balance,
      total_income = @total_income,
      parts = @parts,
      last_collect_at = @last_collect_at,
      farm_json = @farm_json,
      configs_json = @configs_json,
      license_level = @license_level,
      protection_level = @protection_level,
      raid_power = @raid_power,
      turret_json = @turret_json,
      last_wizebot_sync_at = @last_wizebot_sync_at,
      updated_at = @updated_at
    WHERE twitch_id = @twitch_id
  `).run({
    ...imported,
    farm_json: JSON.stringify(farm),
    configs_json: JSON.stringify(configs),
    turret_json: JSON.stringify(turret),
    last_wizebot_sync_at: now,
    updated_at: now,
    twitch_id: userRow.twitch_id
  });

  db.prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userRow.twitch_id,
    'sync_wizebot_full_longtext',
    JSON.stringify({
      login,
      imported
    }),
    now
  );

  const rawProfile = loadProfileByTwitchId(userRow.twitch_id);
  const profile = {
    ...rawProfile,
    farm,
    configs,
    turret
  };

  return {
    ok: true,
    imported,
    profile,
    nextUpgrade: getNextUpgrade(profile),
    buildings: listBuildings(profile)
  };
}

async function importWizebotPayloadByLogin({ login, url }) {
  const expectedLogin = normalizeLogin(login);

  if (!expectedLogin) {
    return { ok: false, error: 'missing_login' };
  }

  const payload = await fetchLongtextJson(url);
  const payloadLogin = normalizeLogin(payload.login);

  if (payloadLogin && payloadLogin !== expectedLogin) {
    return {
      ok: false,
      error: `login_mismatch_payload_${payloadLogin}_expected_${expectedLogin}`
    };
  }

  payload.login = expectedLogin;

  return importPayloadToSqlite(payload);
}

module.exports = {
  fetchLongtextJson,
  importPayloadToSqlite,
  importWizebotPayloadByLogin
};
