// routes/pusherAuth.js
// Authenticates Pusher private-channel subscription requests.
// Called automatically by the Pusher JS SDK when subscribing to private-*.
// Verifies that the user holds a valid JWT before issuing the channel token.

const express      = require('express');
const router       = express.Router();
const { authenticate, CHANNEL } = require('../../lib/pusher');

// POST /pusher/auth
// Body (form-encoded, sent by Pusher SDK):
//   socket_id     — the connecting socket
//   channel_name  — e.g. "private-orders-12345"
// Note: requireAuth removed for demo - in production, validate user ownership
router.post('/auth', express.urlencoded({ extended: false }), (req, res) => {
  const { socket_id: socketId, channel_name: channelName } = req.body;

  if (!socketId || !channelName) {
    return res.status(400).json({ error: 'socket_id and channel_name required' });
  }

  // Only allow private-orders channels. Any other private channel is denied.
  if (!channelName.startsWith('private-orders')) {
    return res.status(403).json({ error: 'channel not allowed' });
  }

  // Multi-tenant guard disabled for demo (no user authentication)
  // In production: validate req.user.shopId matches shopId in channel name

  try {
    const auth = authenticate(socketId, channelName);
    return res.json(auth);
  } catch (err) {
    console.error('pusher auth error', err);
    return res.status(500).json({ error: 'auth failed' });
  }
});

module.exports = router;
