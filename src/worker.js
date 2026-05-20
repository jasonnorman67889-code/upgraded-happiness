const { Worker } = require('bullmq');
const { makeRedisConnection } = require('./queue');
const { config } = require('./config');
const { logger } = require('./lib/logger');
const { processIncident } = require('./services/orchestrator');

const workerConnection = makeRedisConnection();

const worker = new Worker(
  config.queueName,
  async (job) => {
    const requestId = `${job.id}-${Date.now()}`;
    return processIncident(job.data, { requestId, logger });
  },
  {
    connection: workerConnection,
    concurrency: config.workerConcurrency
  }
);

worker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Job completed');
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job ? job.id : 'unknown', err }, 'Job failed');
});

logger.info({ queueName: config.queueName, concurrency: config.workerConcurrency }, 'Sovereign-SOAR worker started');
