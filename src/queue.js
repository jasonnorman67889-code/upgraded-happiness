const IORedis = require('ioredis');
const { Queue } = require('bullmq');
const { config } = require('./config');

function makeRedisConnection() {
  return new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

const queueConnection = makeRedisConnection();
const incidentQueue = new Queue(config.queueName, { connection: queueConnection });

module.exports = {
  incidentQueue,
  makeRedisConnection
};
