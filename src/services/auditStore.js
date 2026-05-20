const { ensureSchema, getPool } = require('../lib/db');

function encodeCursor(cursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(cursorToken) {
  try {
    const parsed = JSON.parse(Buffer.from(cursorToken, 'base64url').toString('utf8'));
    if (!parsed || !parsed.processedAt || typeof parsed.id !== 'number') {
      return null;
    }

    return {
      processedAt: parsed.processedAt,
      id: parsed.id
    };
  } catch (_error) {
    return null;
  }
}

async function persistIncidentResult(result) {
  const pool = getPool();
  if (!pool) {
    return;
  }

  await ensureSchema();

  await pool.query(
    `
      INSERT INTO incident_audit (
        incident_id,
        request_id,
        source_ip,
        enrichment_status,
        enrichment_payload,
        workflow_action,
        processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      result.incidentId,
      result.requestId,
      result.sourceIp || null,
      result.enrichment ? result.enrichment.status : null,
      result.enrichment ? JSON.stringify(result.enrichment) : null,
      result.workflowAction ? JSON.stringify(result.workflowAction) : null,
      result.processedAt
    ]
  );
}

async function getRecentAuditResults(limit, cursorToken, incidentPrefix) {
  const pool = getPool();
  if (!pool) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  await ensureSchema();

  const decodedCursor = cursorToken ? decodeCursor(cursorToken) : null;
  const values = [limit + 1];
  const whereParts = [];
  let paramIndex = 2;

  if (decodedCursor) {
    values.push(decodedCursor.processedAt, decodedCursor.id);
    whereParts.push(`(processed_at, id) < ($${paramIndex}::timestamptz, $${paramIndex + 1}::bigint)`);
    paramIndex += 2;
  }

  if (incidentPrefix) {
    values.push(`${incidentPrefix}%`);
    whereParts.push(`incident_id LIKE $${paramIndex}`);
    paramIndex += 1;
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  const query = `
    SELECT
      id,
      incident_id,
      request_id,
      source_ip,
      enrichment_status,
      enrichment_payload,
      workflow_action,
      processed_at,
      created_at
    FROM incident_audit
    ${whereClause}
    ORDER BY processed_at DESC, id DESC
    LIMIT $1
  `;

  const result = await pool.query(query, values);

  const hasMore = result.rows.length > limit;
  const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;

  const items = pageRows.map((row) => ({
    incidentId: row.incident_id,
    requestId: row.request_id,
    sourceIp: row.source_ip,
    enrichmentStatus: row.enrichment_status,
    enrichment: row.enrichment_payload,
    workflowAction: row.workflow_action,
    processedAt: row.processed_at,
    createdAt: row.created_at
  }));

  let nextCursor = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1];
    nextCursor = encodeCursor({
      processedAt: last.processed_at,
      id: Number(last.id)
    });
  }

  return { items, nextCursor, hasMore };
}

module.exports = { persistIncidentResult, getRecentAuditResults };
