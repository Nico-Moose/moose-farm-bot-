const tmi = require('tmi.js');
const { config } = require('../config');

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
    const text = message.trim().toLowerCase();

    if (text === '!ферма' || text === '!farm') {
      const login = tags.username;
      const url = `${config.publicBaseUrl}/?from=${encodeURIComponent(login)}`;
      await client.say(channel, `@${login}, твоя ферма здесь: ${url} 🌱 Войди через Twitch и играй на сайте.`);
    }
  });

  client.connect()
    .then(() => console.log(`[TWITCH] Chat connected: #${config.twitch.channel}`))
    .catch((error) => console.error('[TWITCH] Chat connection error:', error));

  return client;
}

module.exports = { startTwitchChatBot };
