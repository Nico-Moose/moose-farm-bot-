const { getDb } = require('./dbService');

function normalizeProfile(row) {
  if (!row) return null;

  return {
    ...row,
    level: Number(row.level ?? 0),
    farm_balance: Number(row.farm_balance ?? row.coins ?? 0),
    upgrade_balance: Number(row.upgrade_balance ?? 0),
    total_income: Number(row.total_income ?? 0),
    parts: Number(row.parts ?? 0),
    last_collect_at: row.last_collect_at ? Number(row.last_collect_at) : null,
    created_at: Number(row.created_at) || Date.now(),
    updated_at: Number(row.updated_at) || Date.now(),
  };
}

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

  db.prepare(`
    UPDATE farm_profiles SET
      farm_balance = COALESCE(farm_balance, coins, 0),
      upgrade_balance = COALESCE(upgrade_balance, 0),
      total_income = COALESCE(total_income, 0),
      parts = COALESCE(parts, 0),
      last_collect_at = COALESCE(last_collect_at, ?),
      created_at = CASE
        WHEN typeof(created_at) = 'integer' THEN created_at
        ELSE ?
      END,
      updated_at = CASE
        WHEN typeof(updated_at) = 'integer' THEN updated_at
        ELSE ?
      END
    WHERE twitch_id = ?
  `).run(now, now, now, user.id);
}

function getProfile(twitchId) {
  const row = getDb().prepare(`
    SELECT
      u.twitch_id,
      u.login,
      u.display_name,
      u.avatar_url,

      f.level,
      f.coins,
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

  return normalizeProfile(row);
}

function updateProfile(profile) {
  const safe = normalizeProfile(profile);

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
    ...safe,
    updated_at: Date.now()
  });

  return getProfile(safe.twitch_id);
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
