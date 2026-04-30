const { getDb } = require('./dbService');

function upsertTwitchUser(user) {
  const db = getDb();
  db.prepare(`
    INSERT INTO twitch_users (twitch_id, login, display_name, avatar_url)
    VALUES (@id, @login, @display_name, @profile_image_url)
    ON CONFLICT(twitch_id) DO UPDATE SET
      login = excluded.login,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = CURRENT_TIMESTAMP
  `).run(user);

  db.prepare(`
    INSERT OR IGNORE INTO farm_profiles (twitch_id, level, coins, xp)
    VALUES (?, 1, 0, 0)
  `).run(user.id);
}

function getProfile(twitchId) {
  return getDb().prepare(`
    SELECT u.twitch_id, u.login, u.display_name, u.avatar_url,
           f.level, f.coins, f.xp, f.created_at, f.updated_at
    FROM twitch_users u
    JOIN farm_profiles f ON f.twitch_id = u.twitch_id
    WHERE u.twitch_id = ?
  `).get(twitchId);
}

module.exports = { upsertTwitchUser, getProfile };
