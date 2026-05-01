const path = require('path');
const express = require('express');
const session = require('express-session');
const { config } = require('./config');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');
const bridgeRoutes = require('./routes/bridgeRoutes');
const adminRoutes = require("./routes/adminRoutes");
function startWebServer() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }));

  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/bridge', bridgeRoutes);
const { getDb } = require("./services/dbService");

app.use("/api/admin", adminRoutes(getDb()));
  app.get('/farm', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'farm.html'));
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, service: 'moose-farm-bot' });
  });

  app.listen(config.port, () => {
    console.log(`[WEB] Server started on port ${config.port}`);
    console.log(`[WEB] Public URL: ${config.publicBaseUrl}`);
  });
}

module.exports = { startWebServer };
