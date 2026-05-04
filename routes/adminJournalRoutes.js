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

module.exports = function adminJournalRoutes(db) {
  const router = express.Router();
  router.use(requireAdmin);

  const readCache = new Map();
  const READ_TTL_MS = 1500;

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

  const countQueries = {
    base: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ?`),
    login: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.twitch_id = ?`),
    type: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.type = ?`),
    loginType: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?`),
  };

  const listQueries = {
    base: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE e.created_at >= ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    login: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE e.created_at >= ? AND e.twitch_id = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    type: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE e.created_at >= ? AND e.type = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    loginType: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
  };

  function getCached(key) {
    const hit = readCache.get(key);
    if (!hit) return null;
    if ((Date.now() - hit.ts) > READ_TTL_MS) {
      readCache.delete(key);
      return null;
    }
    return hit.value;
  }

  function setCached(key, value) {
    readCache.set(key, { ts: Date.now(), value });
    if (readCache.size > 150) {
      const firstKey = readCache.keys().next().value;
      if (firstKey) readCache.delete(firstKey);
    }
    return value;
  }

  function getProfileIdByLogin(login) {
    const row = stmtGetProfileIdByLogin.get(normalizeLogin(login));
    return row?.twitch_id || null;
  }

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const cacheKey = `players:${prefix}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const like = `${prefix}%`;
    const players = stmtPlayers.all(prefix, like, like, limit);
    return res.json(setCached(cacheKey, { ok: true, players }));
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const cacheKey = `events:${login}:${type}:${days}:${limit}:${offset}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    let queryKey = 'base';
    const countParams = [since];
    let twitchId = null;

    if (login) {
      twitchId = getProfileIdByLogin(login);
      if (!twitchId) {
        return res.json({ ok: true, events: [], total: 0, hasMore: false, nextOffset: null });
      }
      queryKey = 'login';
      countParams.push(twitchId);
    }

    if (type) {
      if (queryKey === 'login') {
        queryKey = 'loginType';
      } else {
        queryKey = 'type';
      }
      countParams.push(type);
    }

    const totalRow = countQueries[queryKey].get(...countParams);
    const total = Number(totalRow?.total || 0);

    const listParams = countParams.concat([limit, offset]);
    const rows = listQueries[queryKey].all(...listParams);

    const events = rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
    const nextOffset = offset + events.length;
    const payload = {
      ok: true,
      events,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    };
    return res.json(setCached(cacheKey, payload));
  });

  return router;
};
