const tmi = require('tmi.js');
const { config } = require('../config');
const { importWizebotPayloadByLogin } = require('./wizebotBridgeImportService');

function startTwitchChatBot() {
  const client = new tmi.Client({
    options: { debug: false },
    identity: {
      username: config.twitch.botUsername,
      password: config.twitch.botOauth,
    },
    channels: [config.twitch.channel],
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
          await client.say(channel, `@${login}, sync error: ${result.error}`);
          return;
        }

        await client.say(
          channel,
          `@${login}, ✅ сайт-ферма обновлена: ур.${result.imported.level}, 💰${result.imported.farm_balance}, 💎${result.imported.upgrade_balance}, 🔧${result.imported.parts}`
        );
      } catch (error) {
        console.error('[MOOSE_SYNC CHAT] Error:', error);
        await client.say(channel, `@nico_moose, sync failed: ${error.message}`);
      }
    }
  });

  client.connect()
    .then(() => console.log(`[TWITCH] Chat connected: #${config.twitch.channel}`))
    .catch((error) => console.error('[TWITCH] Chat connection error:', error));

  return client;
}

module.exports = { startTwitchChatBot };
