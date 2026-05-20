const pino = require('pino');
const { config } = require('../config');

const logger = pino({
  level: config.logLevel,
  base: { service: 'sovereign-soar' }
});

module.exports = { logger };
