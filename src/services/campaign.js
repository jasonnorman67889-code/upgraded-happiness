const crypto = require('crypto');
const { findRecentCampaignBySignal, saveIncidentCampaign, upsertCampaignSignal } = require('./state');

function buildCampaignSignal(incident, sourceIp) {
  const actor = incident.actorId || 'none';
  return `ip:${sourceIp || 'none'}|actor:${actor}`;
}

function deterministicCampaignId(signal) {
  const digest = crypto.createHash('sha256').update(signal).digest('hex').slice(0, 10);
  return `CMP-${digest.toUpperCase()}`;
}

async function autoMergeIncident(incident, sourceIp) {
  const signal = buildCampaignSignal(incident, sourceIp);
  const existing = await findRecentCampaignBySignal(signal, 24 * 60 * 60);

  if (existing) {
    await saveIncidentCampaign(incident.incidentId, existing.campaignId, 'merge', signal);
    await upsertCampaignSignal(signal, existing.campaignId, 24 * 60 * 60);
    return { action: 'merge', targetId: existing.campaignId, signal };
  }

  const campaignId = deterministicCampaignId(signal);
  await saveIncidentCampaign(incident.incidentId, campaignId, 'create_new', signal);
  await upsertCampaignSignal(signal, campaignId, 24 * 60 * 60);
  return { action: 'create_new', campaignId, signal };
}

module.exports = { autoMergeIncident };
