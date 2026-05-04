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

  router.get('/players', (req, res) => {
    const prefix = normalizeLogin(req.query.prefix || '');
    const like = `${prefix}%`;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit || '12', 10) || 12));
    const players = db.prepare(`
      SELECT u.login, u.display_name, f.level
      FROM twitch_users u
      JOIN farm_profiles f ON f.twitch_id = u.twitch_id
      WHERE ? = '' OR LOWER(u.login) LIKE ? OR LOWER(u.display_name) LIKE ?
      ORDER BY LOWER(u.login) ASC
      LIMIT ?
    `).all(prefix, like, like, limit);
    res.json({ ok: true, players });
  });

  router.get('/events', (req, res) => {
    const login = normalizeLogin(req.query.login || '');
    const type = String(req.query.type || '').trim();
    const days = Math.min(30, Math.max(1, parseInt(req.query.days || '7', 10) || 7));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '100', 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    let where = 'e.created_at >= ?';
    const params = [since];

    if (login) {
      const twitchId = getProfileIdByLogin(db, login);
      if (!twitchId) {
        return res.json({ ok: true, events: [], total: 0, hasMore: false, nextOffset: null });
      }
      where += ' AND e.twitch_id = ?';
      params.push(twitchId);
    }

    if (type) {
      where += ' AND e.type = ?';
      params.push(type);
    }

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total
      FROM farm_events e
      WHERE ${where}
    `).get(...params);
    const total = Number(totalRow?.total || 0);

    const rows = db.prepare(`
      SELECT e.id, e.twitch_id, u.login, u.display_name, e.type, e.payload, e.created_at
      FROM farm_events e
      LEFT JOIN twitch_users u ON u.twitch_id = e.twitch_id
      WHERE ${where}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    const events = rows.map((e) => ({ ...e, payload: parseJsonSafe(e.payload, {}) }));
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
