const crypto = require('crypto');
const express = require('express');
const { config } = require('../config');
const { upsertTwitchUser } = require('../services/userService');

const router = express.Router();

router.get('/twitch', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: config.twitch.clientId,
    redirect_uri: config.twitch.redirectUri,
    response_type: 'code',
    scope: 'user:read:email',
    state,
  });

  res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
});

router.get('/twitch/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send('Invalid OAuth state');
    }

    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.twitch.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      console.error('[AUTH] Token error:', body);
      return res.status(500).send('Twitch token error');
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Client-Id': config.twitch.clientId,
      },
    });

    const userData = await userResponse.json();
    const user = userData.data && userData.data[0];
    if (!user) return res.status(500).send('Twitch user not found');

    upsertTwitchUser(user);
    req.session.twitchUser = {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      avatarUrl: user.profile_image_url,
    };

    res.redirect('/farm');
  } catch (error) {
    console.error('[AUTH] Callback error:', error);
    res.status(500).send('Auth error');
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
