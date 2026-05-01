function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_) {
    return fallback;
  }
}

module.exports = {
  num,
  parseJsonSafe
};
