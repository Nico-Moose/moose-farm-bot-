const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_) {
    return fallback;
  }
}

function normalizeLogin(value) {
  return String(value || '').toLowerCase().replace(/^@/, '').trim();
}

function createReadCache() {
  const map = new Map();
  return {
    get(key, ttlMs) {
      const hit = map.get(key);
      if (!hit) return null;
      if ((Date.now() - hit.ts) > ttlMs) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key, value) {
      map.set(key, { ts: Date.now(), value });
      return value;
    },
  };
}

module.exports = function adminJournalRoutes(db) {
  const router = express.Router();
  router.use(requireAdmin);

  const readCache = createReadCache();
  const stmtGetProfileIdByLogin = db.prepare(`
    SELECT u.twitch_id
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE LOWER(u.login) = ?
    LIMIT 1
  `);

  const stmtPlayers = db.prepare(`
    SELECT u.login, u.display_name, f.level
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
    ORDER BY LOWER(u.login) ASC
    LIMIT ?
  `);

  const eventStmts = {
    all: {
      count: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ?`),
      list: db.prepare(`
        SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
        FROM farm_events e
        LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
        WHERE e.created_at >= ?
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `),
    },
    login: {
      count: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.twitch_id = ?`),
      list: db.prepare(`
        SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
        FROM farm_events e
        LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
        WHERE e.created_at >= ? AND e.twitch_id = ?
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `),
    },
    type: {
      count: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.type = ?`),
      list: db.prepare(`
        SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
        FROM farm_events e
        LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
        WHERE e.created_at >= ? AND e.type = ?
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `),
    },
    loginType: {
      count: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?`),
      list: db.prepare(`
        SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
        FROM farm_events e
        LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
        WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
      `),
    },
  };

  function getProfileIdByLogin(login) {
    const row = stmtGetProfileIdByLogin.get(normalizeLogin(login));
    return row?.twitch_id || null;
  }

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const like = `${prefix}%`;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const cacheKey = `players:${prefix}:${limit}`;
    const cached = readCache.get(cacheKey, 1500);
    if (cached) return res.json(cached);

    const players = stmtPlayers.all(prefix, like, like, limit);
    return res.json(readCache.set(cacheKey, { ok: true, players }));
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const cacheKey = `events:${login}:${type}:${days}:${limit}:${offset}`;
    const cached = readCache.get(cacheKey, 1200);
    if (cached) return res.json(cached);

    let twitchId = null;
    if (login) {
      twitchId = getProfileIdByLogin(login);
      if (!twitchId) {
        return res.json({ ok: true, events: [], total: 0, hasMore: false, nextOffset: null });
      }
    }

    const mode = login && type ? 'loginType' : login ? 'login' : type ? 'type' : 'all';
    const stmts = eventStmts[mode];
    const filterParams = mode === 'loginType' ? [since, twitchId, type] : mode === 'login' ? [since, twitchId] : mode === 'type' ? [since, type] : [since];

    const totalRow = stmts.count.get(...filterParams);
    const total = Number(totalRow?.total || 0);
    const rows = stmts.list.all(...filterParams, limit, offset);
    const events = rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
    const nextOffset = offset + events.length;
    const payload = {
      ok: true,
      events,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    };
    return res.json(readCache.set(cacheKey, payload));
  });

  return router;
};
