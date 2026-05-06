const { config } = require('../config');
const { getDb } = require('./dbService');

let twitchCache = { at: 0, online: false, error: null, confirmed: false };
let tokenCache = { token: null, expiresAt: 0 };

function getSetting(key, fallback = null) {
  try {
    const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (!row) return fallback;
    return row.value;
  } catch (_) {
    return fallback;
  }
}

function setSetting(key, value) {
  getDb().prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, String(value), Date.now());
}

function getManualStreamOverride() {
  const value = String(getSetting('stream_online_manual', 'auto')).toLowerCase();
  if (value === 'true' || value === 'online' || value === '1') return true;
  if (value === 'false' || value === 'offline' || value === '0') return false;
  return null;
}

async function getTwitchAppToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60000) return tokenCache.token;
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;

  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(config.twitch.clientId)}&client_secret=${encodeURIComponent(config.twitch.clientSecret)}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`twitch_token_${res.status}`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expiresAt: now + Math.max(0, Number(json.expires_in || 0) - 60) * 1000
  };
  return tokenCache.token;
}

async function getTwitchStreamStatus() {
  const now = Date.now();
  if (twitchCache.at && now - twitchCache.at < 60000) return twitchCache;

  const channel = String(config.twitch.channel || '').replace(/^@/, '').toLowerCase();
  if (!channel || !config.twitch.clientId || !config.twitch.clientSecret || typeof fetch !== 'function') {
    twitchCache = { at: now, online: false, error: 'twitch_api_not_configured', confirmed: false };
    return twitchCache;
  }

  try {
    const token = await getTwitchAppToken();
    if (!token) throw new Error('no_app_token');
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, {
      headers: {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error(`twitch_stream_${res.status}`);
    const json = await res.json();
    twitchCache = { at: now, online: Array.isArray(json.data) && json.data.length > 0, error: null, confirmed: true };
  } catch (error) {
    twitchCache = { at: now, online: !!twitchCache.online, error: error.message, confirmed: false };
  }
  return twitchCache;
}

async function getStreamStatus() {
  const manual = getManualStreamOverride();
  if (manual !== null) {
    return { online: manual, source: 'manual', checkedAt: Date.now(), error: null };
  }

  const forced = String(process.env.STREAM_ONLINE || '').toLowerCase();
  if (['true', '1', 'online'].includes(forced)) return { online: true, source: 'env', checkedAt: Date.now(), error: null };
  if (['false', '0', 'offline'].includes(forced)) return { online: false, source: 'env', checkedAt: Date.now(), error: null };

  const status = await getTwitchStreamStatus();
  return { online: !!status.online, source: 'twitch', checkedAt: status.at, error: status.error, confirmed: status.confirmed !== false };
}

async function getActualTwitchStreamStatus() {
  const status = await getTwitchStreamStatus();
  return { online: !!status.online, source: 'twitch', checkedAt: status.at, error: status.error, confirmed: status.confirmed !== false };
}


function getStreamStatusSnapshot() {
  const manual = getManualStreamOverride();
  if (manual !== null) return { online: manual, source: 'manual', checkedAt: Date.now(), error: null };
  const forced = String(process.env.STREAM_ONLINE || '').toLowerCase();
  if (['true', '1', 'online'].includes(forced)) return { online: true, source: 'env', checkedAt: Date.now(), error: null };
  if (['false', '0', 'offline'].includes(forced)) return { online: false, source: 'env', checkedAt: Date.now(), error: null };
  return { online: !!twitchCache.online, source: 'cache', checkedAt: twitchCache.at || 0, error: twitchCache.error || null, confirmed: twitchCache.confirmed !== false };
}

module.exports = { getStreamStatus, getActualTwitchStreamStatus, getStreamStatusSnapshot, setSetting, getSetting };

