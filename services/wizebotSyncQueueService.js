const { syncProfileToWizebotIfNeeded } = require('./wizebotApiService');
const { markWizebotSyncAt, logFarmEvent } = require('./userService');

const queueByLogin = new Map();
const runningByLogin = new Set();

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase();
}

function getQueueStats(login) {
  const key = normalizeLogin(login);
  return {
    queued: queueByLogin.has(key),
    running: runningByLogin.has(key)
  };
}

function enqueueProfileSync(profile, options = {}) {
  const login = normalizeLogin(profile?.login);
  if (!login || !profile?.twitch_id) {
    return { ok: false, queued: false, error: 'profile_login_missing' };
  }

  queueByLogin.set(login, {
    profile,
    requestedAt: Date.now(),
    source: options.source || 'api',
    twitchUserId: options.twitchUserId || profile.twitch_id
  });

  setImmediate(() => processSyncQueue(login));

  return {
    ok: true,
    queued: true,
    login,
    requestedAt: Date.now(),
    ...getQueueStats(login)
  };
}

async function processSyncQueue(login) {
  login = normalizeLogin(login);
  if (!login || runningByLogin.has(login)) return;

  const item = queueByLogin.get(login);
  if (!item) return;

  runningByLogin.add(login);

  try {
    while (queueByLogin.has(login)) {
      const current = queueByLogin.get(login);
      queueByLogin.delete(login);

      try {
        const result = await syncProfileToWizebotIfNeeded(current.profile);
        if (result?.ok || (Array.isArray(result?.keys) && result.keys.length > 0)) {
          markWizebotSyncAt(current.profile.twitch_id, result.syncedAt || Date.now());
        } else {
          logFarmEvent(current.twitchUserId, 'sync_wizebot_push_async_failed', {
            login: current.profile.login,
            source: current.source || 'api',
            failedKeys: result?.failedKeys || [],
            error: result?.error || 'unknown_sync_error'
          });
        }
      } catch (error) {
        console.error('[WIZEBOT ASYNC SYNC] Error:', error);
        logFarmEvent(current.twitchUserId, 'sync_wizebot_push_async_failed', {
          login: current.profile.login,
          source: current.source || 'api',
          message: error.message,
          details: error.details || null
        });
      }
    }
  } finally {
    runningByLogin.delete(login);
    if (queueByLogin.has(login)) {
      setImmediate(() => processSyncQueue(login));
    }
  }
}

module.exports = {
  enqueueProfileSync,
  getQueueStats
};
