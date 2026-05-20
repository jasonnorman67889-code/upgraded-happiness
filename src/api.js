const express = require('express');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const { logger } = require('./lib/logger');
const { config } = require('./config');
const { incidentQueue } = require('./queue');
const { validateJwt } = require('./middleware/auth');
const { validateIncident } = require('./middleware/validate');
const { seenIncident, markIncidentSeen } = require('./services/idempotency');
const { setupHudRealtime } = require('./services/hudRealtime');
const { getRecentAuditResults } = require('./services/auditStore');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sovereign-soar-api' });
});

app.get('/api/v1/audits', validateJwt, async (req, res) => {
  const rawLimit = Number.parseInt(String(req.query.limit || '100'), 10);
  const limit = Number.isNaN(rawLimit) ? 100 : Math.max(1, Math.min(rawLimit, 500));
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
  const incidentPrefix = typeof req.query.incidentPrefix === 'string' ? req.query.incidentPrefix : '';

  try {
    const page = await getRecentAuditResults(limit, cursor, incidentPrefix);
    res.json({
      items: page.items,
      count: page.items.length,
      limit,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      incidentPrefix: incidentPrefix || null
    });
  } catch (error) {
    req.log.error({ err: error }, 'Failed to fetch audit history');
    res.status(500).json({ error: 'audit_fetch_failed' });
  }
});

app.post('/api/v1/workflow/sentinel-replacement', validateJwt, validateIncident, async (req, res) => {
  const incidentId = req.body.incidentId;
  const requestId = req.headers['x-request-id'] || randomUUID();

  try {
    if (await seenIncident(incidentId)) {
      res.status(202).json({
        requestId,
        incidentId,
        status: 'accepted',
        duplicate: true,
        message: 'Incident already seen in dedup window'
      });
      return;
    }

    await markIncidentSeen(incidentId);

    await incidentQueue.add('process-incident', req.body, {
      jobId: incidentId,
      removeOnComplete: true,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });

    res.status(202).json({ requestId, incidentId, status: 'accepted' });
  } catch (error) {
    req.log.error({ err: error, incidentId, requestId }, 'Failed to enqueue incident');
    res.status(500).json({ error: 'enqueue_failed', requestId });
  }
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, wsPath: '/ws/hud' }, 'Sovereign-SOAR API listening');
});

setupHudRealtime(server, logger);
