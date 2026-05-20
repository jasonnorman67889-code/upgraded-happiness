const { makeRedisConnection } = require('../queue');

const redis = makeRedisConnection();

function campaignSignalKey(signal) {
  return `campaign:signal:${signal}`;
}

function campaignIncidentKey(incidentId) {
  return `campaign:incident:${incidentId}`;
}

async function findRecentCampaignBySignal(signal, windowSeconds) {
  const key = campaignSignalKey(signal);
  const payload = await redis.hgetall(key);

  if (!payload || !payload.campaignId || !payload.lastSeenEpochMs) {
    return null;
  }

  const ageMs = Date.now() - Number(payload.lastSeenEpochMs);
  if (ageMs > windowSeconds * 1000) {
    return null;
  }

  return {
    campaignId: payload.campaignId,
    lastSeenEpochMs: Number(payload.lastSeenEpochMs)
  };
}

async function upsertCampaignSignal(signal, campaignId, ttlSeconds) {
  const key = campaignSignalKey(signal);
  await redis.hset(key, {
    campaignId,
    lastSeenEpochMs: String(Date.now())
  });
  await redis.expire(key, ttlSeconds);
}

async function saveIncidentCampaign(incidentId, campaignId, action, signal) {
  const key = campaignIncidentKey(incidentId);
  await redis.hset(key, {
    incidentId,
    campaignId,
    action,
    signal: signal || '',
    updatedAt: new Date().toISOString()
  });
  await redis.expire(key, 7 * 24 * 60 * 60);
}

module.exports = {
  findRecentCampaignBySignal,
  upsertCampaignSignal,
  saveIncidentCampaign
};
