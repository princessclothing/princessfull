/**
 * Pusher channel authentication endpoint
 * 
 * Este endpoint autentica clientes Pusher para canais privados.
 * É chamado automaticamente pelo Pusher JS SDK ao se inscrever em canais private-*.
 */

const Pusher = require('pusher');

module.exports = async (req, res) => {
  // Permitir apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    // Parsear body (pode vir como application/x-www-form-urlencoded)
    let socketId, channelName;

    if (typeof req.body === 'string') {
      // Parse form-encoded body
      const params = new URLSearchParams(req.body);
      socketId = params.get('socket_id');
      channelName = params.get('channel_name');
    } else {
      // JSON body
      socketId = req.body.socket_id;
      channelName = req.body.channel_name;
    }

    console.log('[pusher/auth] Request:', { socketId, channelName });

    if (!socketId || !channelName) {
      return res.status(400).json({ 
        error: 'socket_id and channel_name required',
        received: { socketId: !!socketId, channelName: !!channelName }
      });
    }

    // Validar que o canal é um canal de ordens permitido
    if (!channelName.startsWith('private-orders')) {
      return res.status(403).json({ 
        error: 'channel not allowed',
        channel: channelName 
      });
    }

    // Instanciar Pusher
    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });

    // Autenticar canal privado
    const auth = pusher.authorizeChannel(socketId, channelName);

    console.log('[pusher/auth] Success:', { channel: channelName });

    return res.status(200).json(auth);

  } catch (err) {
    console.error('[pusher/auth] Error:', err.message);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: err.message 
    });
  }
};
