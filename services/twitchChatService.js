const tmi = require('tmi.js');
const { config } = require('../config');
const { importWizebotPayloadByLogin } = require('./wizebotBridgeImportService');

let activeClient = null;
let activeChannel = null;
let connected = false;

function shouldAnnounceSyncChat() {
  return !!config.debugSyncChat;
}

function normalizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
}

async function sayToChannel(message) {
  if (!activeClient || !activeChannel || !connected) {
    return { ok: false, skipped: true, reason: 'twitch_chat_not_connected' };
  }

  await activeClient.say(activeChannel, message);
  return { ok: true, message };
}

async function triggerWizebotWebMasterApply(login) {
  const normalized = normalizeLogin(login);
  if (!normalized) return { ok: false, error: 'missing_login' };

  // Эта команда должна быть создана в WizeBot из файла wizebot_commands/!сайтфермапуш.txt.
  // Она сама забирает состояние сайта через /bridge/web-master-state и делает JS.wizebot.set_var(...).
  return sayToChannel(`!сайтфермапуш ${normalized}`);
}

function startTwitchChatBot() {
  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: config.twitch.botUsername,
      password: config.twitch.botOauth,
    },
    channels: [config.twitch.channel],
  });

  activeClient = client;
  activeChannel = `#${String(config.twitch.channel || '').replace(/^#/, '')}`;

  client.on('connected', () => {
    connected = true;
  });

  client.on('disconnected', () => {
    connected = false;
  });

  client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const text = message.trim();
    const lower = text.toLowerCase();

    if (lower === '!тестферма') {
      const login = tags.username;
      const url = `${config.publicBaseUrl}/?from=${encodeURIComponent(login)}`;

      await client.say(
        channel,
        `@${login}, тестовая ферма здесь: ${url} 🌱 Войди через Twitch и играй на сайте.`
      );

      return;
    }

    if (text.startsWith('MOOSE_SYNC ')) {
      try {
        const parts = text.split(/\s+/);
        const login = String(parts[1] || '').trim().toLowerCase();
        const url = parts[2];

        if (!login) return;
        if (!url || !url.startsWith('https://strm.lv/t/longtexts/')) return;

        const result = await importWizebotPayloadByLogin({
          login,
          url
        });

        if (!result.ok) {
          if (shouldAnnounceSyncChat()) {
            await client.say(channel, `@${login}, sync error: ${result.error}`);
          }
          return;
        }

        if (shouldAnnounceSyncChat()) {
          await client.say(
            channel,
            `@${login}, ✅ сайт-ферма обновлена: ур.${result.imported.level}, 💰${result.imported.twitch_balance}, 🌾${result.imported.farm_balance}, 💎${result.imported.upgrade_balance}, 🔧${result.imported.parts}`
          );
        }
      } catch (error) {
        console.error('[MOOSE_SYNC CHAT] Error:', error);
        if (shouldAnnounceSyncChat()) {
          await client.say(channel, `@nico_moose, sync failed: ${error.message}`);
        }
      }
    }
  });

  client.connect()
    .then(() => console.log(`[TWITCH] Chat connected: #${config.twitch.channel}`))
    .catch((error) => console.error('[TWITCH] Chat connection error:', error));

  return client;
}

module.exports = {
  startTwitchChatBot,
  sayToChannel,
  triggerWizebotWebMasterApply
};
