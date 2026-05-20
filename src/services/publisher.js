const { makeRedisConnection } = require('../queue');
const { config } = require('../config');

const redis = makeRedisConnection();

async function publishHudEvent(eventName, payload) {
  const envelope = {
    eventName,
    payload,
    publishedAt: new Date().toISOString()
  };

  await redis.publish(config.hudChannel, JSON.stringify(envelope));
}

module.exports = { publishHudEvent };
