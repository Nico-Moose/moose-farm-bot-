const { getDb } = require('./dbService');

function upsertTwitchUser(user) {
  const db = getDb();
  const now = Date.now();

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
    INSERT OR IGNORE INTO farm_profiles (
      twitch_id,
      level,
      farm_balance,
      upgrade_balance,
      total_income,
      parts,
      last_collect_at,
      created_at,
      updated_at
    )
    VALUES (?, 0, 0, 0, 0, 0, ?, ?, ?)
  `).run(user.id, now, now, now);
}

function getProfile(twitchId) {
  return getDb().prepare(`
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
  `).get(twitchId);
}

function updateProfile(profile) {
  getDb().prepare(`
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
    ...profile,
    updated_at: Date.now()
  });

  return getProfile(profile.twitch_id);
}

function logFarmEvent(twitchId, type, payload = {}) {
  getDb().prepare(`
    INSERT INTO farm_events (twitch_id, type, payload, created_at)
    VALUES (?, ?, ?, ?)
  `).run(twitchId, type, JSON.stringify(payload), Date.now());
}

module.exports = {
  upsertTwitchUser,
  getProfile,
  updateProfile,
  logFarmEvent
};
