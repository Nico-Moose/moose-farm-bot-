# Moose Farm Bot Starter

Twitch chat bot + web site for visual farm.

## Flow

1. User writes `!ферма` or `!farm` in Twitch chat.
2. Bot replies with your public site link.
3. User logs in with Twitch OAuth.
4. Site creates/opens user's farm profile in SQLite.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Use Node.js 20 Debian Slim on hosting.
