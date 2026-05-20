const { enrichGeoIP } = require('./enrichment');
const { autoMergeIncident } = require('./campaign');
const { publishHudEvent } = require('./publisher');
const { persistIncidentResult } = require('./auditStore');

async function processIncident(payload, context) {
  const { incidentId, entities } = payload;
  const ipEntity = entities.find((entity) => entity.type.toLowerCase() === 'ip' && entity.address);

  const enrichment = ipEntity ? await enrichGeoIP(ipEntity.address) : { status: 'skipped', reason: 'no_ip_entity' };
  const workflowAction = await autoMergeIncident(payload, ipEntity ? ipEntity.address : null);

  const result = {
    incidentId,
    sourceIp: ipEntity ? ipEntity.address : null,
    enrichment,
    workflowAction,
    processedAt: new Date().toISOString(),
    requestId: context.requestId
  };

  try {
    await persistIncidentResult(result);
  } catch (error) {
    context.logger.error({ err: error, incidentId }, 'Failed to persist audit record');
  }

  await publishHudEvent('incident.processed', result);
  context.logger.info({ incidentId, workflowAction, requestId: context.requestId }, 'Incident processed');

  return result;
}

module.exports = { processIncident };
