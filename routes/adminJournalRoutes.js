const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getCache, setCache } = require('../services/apiCacheService');

const PLAYERS_CACHE_TTL_MS = 1200;
const EVENTS_CACHE_TTL_MS = 1200;

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

  const findTwitchIdByLoginStmt = db.prepare(`
    SELECT u.twitch_id
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE LOWER(u.login) = ?
    LIMIT 1
  `);

  const listPlayersStmt = db.prepare(`
    SELECT u.login, u.display_name, f.level
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
    ORDER BY LOWER(u.login) ASC
    LIMIT ?
  `);

  const countEventsByDaysStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ?
  `);
  const countEventsByLoginStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.twitch_id = ?
  `);
  const countEventsByTypeStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.type = ?
  `);
  const countEventsByLoginAndTypeStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
  `);

  const listEventsByDaysStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const listEventsByLoginStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.twitch_id = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const listEventsByTypeStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.type = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);
  const listEventsByLoginAndTypeStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);

  function getProfileIdByLogin(login) {
    const row = findTwitchIdByLoginStmt.get(normalizeLogin(login));
    return row?.twitch_id || null;
  }

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const cacheKey = `admin:journal:players:${prefix}:${limit}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    const like = `${prefix}%`;
    const players = listPlayersStmt.all(prefix, like, like, limit);
    const payload = { ok: true, players };
    setCache(cacheKey, payload, PLAYERS_CACHE_TTL_MS);
    res.json(payload);
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const cacheKey = `admin:journal:events:${login}:${type}:${days}:${limit}:${offset}`;
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    let twitchId = null;
    if (login) {
      twitchId = getProfileIdByLogin(login);
      if (!twitchId) {
        const emptyPayload = { ok: true, events: [], total: 0, hasMore: false, nextOffset: null };
        setCache(cacheKey, emptyPayload, EVENTS_CACHE_TTL_MS);
        return res.json(emptyPayload);
      }
    }

    let totalRow;
    let rows;
    if (login && type) {
      totalRow = countEventsByLoginAndTypeStmt.get(since, twitchId, type);
      rows = listEventsByLoginAndTypeStmt.all(since, twitchId, type, limit, offset);
    } else if (login) {
      totalRow = countEventsByLoginStmt.get(since, twitchId);
      rows = listEventsByLoginStmt.all(since, twitchId, limit, offset);
    } else if (type) {
      totalRow = countEventsByTypeStmt.get(since, type);
      rows = listEventsByTypeStmt.all(since, type, limit, offset);
    } else {
      totalRow = countEventsByDaysStmt.get(since);
      rows = listEventsByDaysStmt.all(since, limit, offset);
    }

    const total = Number(totalRow?.total || 0);
    const events = rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
    const nextOffset = offset + events.length;
    const payload = {
      ok: true,
      events,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    };
    setCache(cacheKey, payload, EVENTS_CACHE_TTL_MS);
    res.json(payload);
  });

  return router;
};
