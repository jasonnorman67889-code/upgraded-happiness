const { Pool } = require('pg');
const { config } = require('../config');

let pool = null;
let schemaInitialized = false;

function getPool() {
  if (!config.databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
  }

  return pool;
}

async function ensureSchema() {
  const db = getPool();
  if (!db || schemaInitialized) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS incident_audit (
      id BIGSERIAL PRIMARY KEY,
      incident_id TEXT NOT NULL,
      request_id TEXT,
      source_ip TEXT,
      enrichment_status TEXT,
      enrichment_payload JSONB,
      workflow_action JSONB,
      processed_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_incident_audit_incident_id ON incident_audit(incident_id);'
  );

  schemaInitialized = true;
}

module.exports = {
  getPool,
  ensureSchema
};
