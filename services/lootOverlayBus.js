const clients = new Set();

function addClient(res) {
  clients.add(res);

  const cleanup = () => {
    clients.delete(res);
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
}

function sendEvent(type, payload) {
  const packet = JSON.stringify({
    type: String(type || 'message'),
    payload: payload || {},
    ts: Date.now()
  });

  for (const res of Array.from(clients)) {
    try {
      res.write(`event: ${type}\n`);
      res.write(`data: ${packet}\n\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    } catch (_) {
      try {
        res.end();
      } catch (__) {}
      clients.delete(res);
    }
  }
}

module.exports = {
  addClient,
  sendEvent
};
