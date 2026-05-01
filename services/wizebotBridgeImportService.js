const { getDb } = require('./dbService');
const { getNextUpgrade } = require('./farmGameService');

const ALLOWED_LOGIN = 'nico_moose';

function decodeHtml(text) {
  return String(text || '')
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
    .trim();
}

function extractJson(text) {
  const decoded = decodeHtml(text);

  const start = decoded.indexOf('{');
  const end = decoded.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('JSON not found in longtext');
  }

  let json = decoded.slice(start, end + 1);

  // убираем невидимые символы
  json = json
    .replace(/\u200B/g, '')
    .replace(/\u200C/g, '')
    .replace(/\u200D/g, '')
    .replace(/\uFEFF/g, '')
    .trim();

  return JSON.parse(json);
}

async function fetchLongtextJson(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Longtext fetch failed: ${res.status}`);
  }

  const html = await res.text();

  try {
    return extractJson(html);
  } catch (error) {
    console.error('[LONGTEXT RAW START]', html.slice(0, 1000));
    console.error('[LONGTEXT RAW END]', html.slice(-1000));
    throw error;
  }
}

function normalizeNumber(value) {
  return Number(value || 0) || 0;
}

function importPayloadToSqlite(payload) {
  const login = String(payload.login || '').toLowerCase();

  if (login !== ALLOWED_LOGIN) {
    return {
      ok: false,
      error: 'sync_allowed_only_for_nico_moose'
    };
  }

  const db = getDb();
  const now = Date.now();

  const farm = payload.farm || {};
  const resources = farm.resources || {};

  const userRow = db.prepare(`
    SELECT twitch_id
    FROM twitch_users
    WHERE LOWER(login) = ?
    LIMIT 1
  `).get(login);

  if (!userRow) {
    return {
      ok: false,
      error: 'site_user_not_found_login_with_twitch_first'
    };
  }

  const imported = {
    level: normalizeNumber(farm.level),
    farm_balance: normalizeNumber(payload.farm_balance),
    upgrade_balance: normalizeNumber(payload.upgrade_balance),
    total_income: normalizeNumber(payload.total_income),
    parts: normalizeNumber(resources.parts),
    last_collect_at: normalizeNumber(payload.last_collect_at) || now
  };

  db.prepare(`
    UPDATE farm_profiles SET
      level = @level,
      farm_balance = @farm_balance,
      upgrade_balance = @upgrade_balance,
      total_income = @total_income,
      parts = @parts,
      last_collect_at = @last_collect_at,
      updated_at = @updated_at
    WHERE twitch_id = @twitch_id
  `).run({
    ...imported,
    updated_at: now,
    twitch_id: userRow.twitch_id
  });

  db.prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    userRow.twitch_id,
    'sync_wizebot_longtext',
    JSON.stringify({
      source: 'twitch_chat_longtext',
      imported
    }),
    now
  );

  const profile = db.prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,
      f.level,
      f.farm_balance,
      f.upgrade_balance,
      f.total_income,
      f.parts,
      f.last_collect_at,
      f.created_at,
      f.updated_at
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE u.twitch_id = ?
  `).get(userRow.twitch_id);

  return {
    ok: true,
    imported,
    profile,
    nextUpgrade: getNextUpgrade(profile)
  };
}

async function importWizebotPayloadByLogin({ login, url }) {
  if (String(login || '').toLowerCase() !== ALLOWED_LOGIN) {
    return {
      ok: false,
      error: 'sync_allowed_only_for_nico_moose'
    };
  }

  const payload = await fetchLongtextJson(url);
  return importPayloadToSqlite(payload);
}

module.exports = {
  fetchLongtextJson,
  importPayloadToSqlite,
  importWizebotPayloadByLogin
};
