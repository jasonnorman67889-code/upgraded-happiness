require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultJwtMode = nodeEnv === 'development' ? 'disabled' : 'jwks';
const allowedJwtModes = new Set(['disabled', 'hs256', 'jwks']);

let resolvedJwtMode = process.env.JWT_MODE || defaultJwtMode;
if (!allowedJwtModes.has(resolvedJwtMode)) {
  resolvedJwtMode = defaultJwtMode;
}

if (nodeEnv !== 'development' && resolvedJwtMode === 'disabled') {
  // Guardrail: non-dev environments should require token validation.
  resolvedJwtMode = 'jwks';
}

const defaultWsJwtRequired = resolvedJwtMode !== 'disabled' ? 'true' : 'false';

const config = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
  databaseUrl: process.env.DATABASE_URL || '',
  queueName: process.env.QUEUE_NAME || 'incident-processing',
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  jwtMode: resolvedJwtMode,
  wsJwtRequired: (process.env.WS_JWT_REQUIRED || defaultWsJwtRequired) === 'true',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtIssuer: process.env.JWT_ISSUER || '',
  jwtAudience: process.env.JWT_AUDIENCE || '',
  jwksUri: process.env.JWKS_URI || '',
  hudChannel: process.env.HUD_CHANNEL || 'hud.incident.processed'
};

module.exports = { config };
