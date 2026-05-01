require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  databasePath: process.env.DATABASE_PATH || './data/farm.sqlite',

  twitch: {
    channel: process.env.TWITCH_CHANNEL,
    botUsername: process.env.TWITCH_BOT_USERNAME,
    botOauth: process.env.TWITCH_BOT_OAUTH,
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI,
  },

  wizebot: {
    apiKey: process.env.WIZEBOT_API_KEY,
    apiKeyRw: process.env.WIZEBOT_API_KEY_RW,
    bridgeSecret: process.env.WIZEBOT_BRIDGE_SECRET || 'change-me-bridge-secret',
  },
};

function validateConfig() {
  const missing = [];

  if (!config.twitch.channel) missing.push('TWITCH_CHANNEL');
  if (!config.twitch.botUsername) missing.push('TWITCH_BOT_USERNAME');
  if (!config.twitch.botOauth) missing.push('TWITCH_BOT_OAUTH');
  if (!config.twitch.clientId) missing.push('TWITCH_CLIENT_ID');
  if (!config.twitch.clientSecret) missing.push('TWITCH_CLIENT_SECRET');
  if (!config.twitch.redirectUri) missing.push('TWITCH_REDIRECT_URI');
  if (!config.publicBaseUrl) missing.push('PUBLIC_BASE_URL');

  if (!process.env.WIZEBOT_BRIDGE_SECRET) {
    console.warn('[CONFIG] WIZEBOT_BRIDGE_SECRET is not set. Use a strong secret in production.');
  }

  if (missing.length) {
    console.warn('[CONFIG] Missing env:', missing.join(', '));
  }
}

module.exports = { config, validateConfig };
