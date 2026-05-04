const DEFAULT_TTL_MS = 1500;

const cache = new Map();

function now() {
  return Date.now();
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: now() + Math.max(1, Number(ttlMs) || DEFAULT_TTL_MS)
  });
  return value;
}

function getOrSetCache(key, ttlMs, producer) {
  const cached = getCache(key);
  if (cached !== null && cached !== undefined) return cached;
  return setCache(key, producer(), ttlMs);
}

function deleteCache(key) {
  cache.delete(key);
}

function invalidatePrefix(prefix) {
  for (const key of cache.keys()) {
    if (String(key).startsWith(prefix)) cache.delete(key);
  }
}

function invalidateFarmCache(twitchId) {
  if (twitchId) invalidatePrefix(`farm:${twitchId}:`);
  invalidatePrefix('farm:top:');
}

function clearCache() {
  cache.clear();
}

module.exports = {
  getCache,
  setCache,
  getOrSetCache,
  deleteCache,
  invalidatePrefix,
  invalidateFarmCache,
  clearCache
};
