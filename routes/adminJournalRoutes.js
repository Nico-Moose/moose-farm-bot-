const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getCache, setCache } = require('../services/apiCacheService');

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

function buildEventsFilterKey(login, type) {
  if (login && type) return 'loginType';
  if (login) return 'login';
  if (type) return 'type';
  return 'base';
}

function buildEventsWhere(filterKey) {
  if (filterKey === 'loginType') return 'e.created_at >= ? AND e.twitch_id = ? AND e.type = ?';
  if (filterKey === 'login') return 'e.created_at >= ? AND e.twitch_id = ?';
  if (filterKey === 'type') return 'e.created_at >= ? AND e.type = ?';
  return 'e.created_at >= ?';
}

module.exports = function adminJournalRoutes(db) {
  const router = express.Router();
  router.use(requireAdmin);

  const getProfileIdByLoginStmt = db.prepare(`
    SELECT u.twitch_id
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE LOWER(u.login) = ?
    LIMIT 1
  `);

  const playersStmt = db.prepare(`
    SELECT u.login, u.display_name, f.level
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
    ORDER BY LOWER(u.login) ASC
    LIMIT ?
  `);

  const eventCountStmts = {
    base: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE ${buildEventsWhere('base')}`),
    login: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE ${buildEventsWhere('login')}`),
    type: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE ${buildEventsWhere('type')}`),
    loginType: db.prepare(`SELECT COUNT(*) AS total FROM farm_events e WHERE ${buildEventsWhere('loginType')}`)
  };

  const eventListStmts = {
    base: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE ${buildEventsWhere('base')}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    login: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE ${buildEventsWhere('login')}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    type: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE ${buildEventsWhere('type')}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `),
    loginType: db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE ${buildEventsWhere('loginType')}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `)
  };

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const cacheKey = `admin:journal:players:${prefix}:${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const like = `${prefix}%`;
    const payload = { ok: true, players: playersStmt.all(prefix, like, like, limit) };
    res.json(setCache(cacheKey, payload, 1500));
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const cacheKey = `admin:journal:events:${login || 'all'}:${type || 'all'}:${days}:${limit}:${offset}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    let twitchId = null;
    if (login) {
      const row = getProfileIdByLoginStmt.get(login);
      twitchId = row?.twitch_id || null;
      if (!twitchId) {
        return res.json({ ok: true, events: [], total: 0, hasMore: false, nextOffset: null });
      }
    }

    const filterKey = buildEventsFilterKey(login, type);
    const params = [since];
    if (filterKey === 'login' || filterKey === 'loginType') params.push(twitchId);
    if (filterKey === 'type' || filterKey === 'loginType') params.push(type);

    const total = Number(eventCountStmts[filterKey].get(...params)?.total || 0);
    const rows = eventListStmts[filterKey].all(...params, limit, offset);
    const events = rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
    const nextOffset = offset + events.length;
    const payload = {
      ok: true,
      events,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    };
    res.json(setCache(cacheKey, payload, 1500));
  });

  return router;
};
