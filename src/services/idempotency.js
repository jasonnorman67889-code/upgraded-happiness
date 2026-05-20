const { makeRedisConnection } = require('../queue');
const { config } = require('../config');

const redis = makeRedisConnection();

function incidentSeenKey(incidentId) {
  return `incident:seen:${incidentId}`;
}

async function seenIncident(incidentId) {
  const key = incidentSeenKey(incidentId);
  const seen = await redis.get(key);
  return Boolean(seen);
}

async function markIncidentSeen(incidentId) {
  const key = incidentSeenKey(incidentId);
  await redis.set(key, '1', 'EX', config.idempotencyTtlSeconds);
}

module.exports = {
  seenIncident,
  markIncidentSeen
};
