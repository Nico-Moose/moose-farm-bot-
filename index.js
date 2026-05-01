require('dotenv').config();
const { validateConfig } = require('./config');
const { getDb, closeDb } = require('./services/dbService');
const { startWebServer } = require('./server');
const { startTwitchChatBot } = require('./services/twitchChatService');

validateConfig();
getDb();
startWebServer();
startTwitchChatBot();

process.on('SIGINT', () => {
  console.log('[APP] SIGINT received. Closing DB...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[APP] SIGTERM received. Closing DB...');
  closeDb();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('[APP] Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('[APP] Uncaught exception:', error);
});
