const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const { getOrSetCache } = require('../services/apiCacheService');

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

function getProfileIdByLogin(db, login) {
  const row = db.prepare(`
    SELECT u.twitch_id
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE LOWER(u.login) = ?
    LIMIT 1
  `).get(normalizeLogin(login));
  return row?.twitch_id || null;
}

module.exports = function adminJournalRoutes(db) {
  const router = express.Router();
  router.use(requireAdmin);

  const listPlayersStmt = db.prepare(`
    SELECT u.login, u.display_name, f.level
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
    ORDER BY LOWER(u.login) ASC
    LIMIT ?
  `);

  const getProfileIdByLoginStmt = db.prepare(`
    SELECT u.twitch_id
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE LOWER(u.login) = ?
    LIMIT 1
  `);

  const eventsCountByLoginAndTypeStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
  `);

  const eventsListByLoginAndTypeStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.twitch_id = ? AND e.type = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const eventsCountByLoginStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.twitch_id = ?
  `);

  const eventsListByLoginStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.twitch_id = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const eventsCountByTypeStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ? AND e.type = ?
  `);

  const eventsListByTypeStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ? AND e.type = ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);

  const eventsCountSinceStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM farm_events e
    WHERE e.created_at >= ?
  `);

  const eventsListSinceStmt = db.prepare(`
    SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
    FROM farm_events e
    LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
    WHERE e.created_at >= ?
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `);

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const like = `${prefix}%`;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const cacheKey = `admin:journal:players:${prefix}:${limit}`;

    const players = getOrSetCache(cacheKey, 1500, () => (
      listPlayersStmt.all(prefix, like, like, limit)
    ));

    res.json({ ok: true, players });
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const cacheKey = `admin:journal:events:${login}:${type}:${days}:${limit}:${offset}`;
    const result = getOrSetCache(cacheKey, 1200, () => {
      let twitchId = null;
      if (login) {
        const row = getProfileIdByLoginStmt.get(login);
        twitchId = row?.twitch_id || null;
        if (!twitchId) {
          return { events: [], total: 0 };
        }
      }

      let totalRow;
      let rows;

      if (twitchId && type) {
        totalRow = eventsCountByLoginAndTypeStmt.get(since, twitchId, type);
        rows = eventsListByLoginAndTypeStmt.all(since, twitchId, type, limit, offset);
      } else if (twitchId) {
        totalRow = eventsCountByLoginStmt.get(since, twitchId);
        rows = eventsListByLoginStmt.all(since, twitchId, limit, offset);
      } else if (type) {
        totalRow = eventsCountByTypeStmt.get(since, type);
        rows = eventsListByTypeStmt.all(since, type, limit, offset);
      } else {
        totalRow = eventsCountSinceStmt.get(since);
        rows = eventsListSinceStmt.all(since, limit, offset);
      }

      return {
        total: Number(totalRow?.total || 0),
        events: rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) })),
      };
    });

    const total = Number(result.total || 0);
    const events = result.events || [];
    const nextOffset = offset + events.length;
    res.json({
      ok: true,
      events,
      total,
      hasMore: nextOffset < total,
      nextOffset: nextOffset < total ? nextOffset : null,
    });
  });

  return router;
};
