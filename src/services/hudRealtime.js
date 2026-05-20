const { WebSocketServer } = require('ws');
const { makeRedisConnection } = require('../queue');
const { config } = require('../config');
const { verifyToken } = require('../middleware/auth');

function getTokenFromRequest(request) {
  const authHeader = request.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const url = new URL(request.url || '', 'http://localhost');
  return url.searchParams.get('token');
}

function setupHudRealtime(httpServer, logger) {
  const wsServer = new WebSocketServer({ server: httpServer, path: '/ws/hud' });
  const subscriber = makeRedisConnection();

  wsServer.on('connection', async (socket, request) => {
    if (config.wsJwtRequired) {
      const token = getTokenFromRequest(request);

      if (!token) {
        socket.close(1008, 'missing_token');
        return;
      }

      try {
        await verifyToken(token);
      } catch (_err) {
        socket.close(1008, 'invalid_token');
        return;
      }
    }

    socket.send(
      JSON.stringify({
        eventName: 'hud.connected',
        payload: { message: 'Connected to Sovereign-SOAR HUD stream' },
        publishedAt: new Date().toISOString()
      })
    );
  });

  subscriber.subscribe(config.hudChannel, (err) => {
    if (err) {
      logger.error({ err }, 'Failed to subscribe to HUD channel');
      return;
    }

    logger.info({ channel: config.hudChannel }, 'HUD realtime subscription active');
  });

  subscriber.on('message', (_channel, message) => {
    for (const client of wsServer.clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  });

  wsServer.on('close', () => {
    subscriber.disconnect();
  });

  return wsServer;
}

module.exports = { setupHudRealtime };
