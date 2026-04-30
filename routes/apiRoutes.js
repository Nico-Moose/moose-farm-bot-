const express = require('express');
const { getProfile } = require('../services/userService');

const router = express.Router();

router.get('/me', (req, res) => {
  if (!req.session.twitchUser) {
    return res.status(401).json({ ok: false, error: 'not_logged_in' });
  }

  const profile = getProfile(req.session.twitchUser.id);
  res.json({ ok: true, user: req.session.twitchUser, profile });
});

module.exports = router;
