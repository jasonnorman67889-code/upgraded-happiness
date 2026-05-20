const baseUrl = process.env.SOAR_BASE_URL || 'http://localhost:3000';
const limit = Number(process.env.SOAR_AUDIT_LIMIT || 2);
const expectedCount = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  let payload = {};

  try {
    payload = await response.json();
  } catch (_error) {
    payload = {};
  }

  return { response, payload };
}

function auditsUrl(incidentPrefix, cursor, auditLimit = limit) {
  const query = new URLSearchParams({
    limit: String(auditLimit),
    incidentPrefix
  });

  if (cursor) {
    query.set('cursor', cursor);
  }

  return `${baseUrl}/api/v1/audits?${query.toString()}`;
}

async function ensureHealth() {
  const { response, payload } = await fetchJson(`${baseUrl}/health`, { method: 'GET' });
  assert(response.ok, `Health check failed: status=${response.status}`);
  assert(payload.ok === true, 'Health response missing ok=true');
}

function makeIncidents() {
  const prefix = `INC-IT-${Date.now()}-`;
  const incidents = [
    { incidentId: `${prefix}1`, entities: [{ type: 'ip', address: '8.8.8.8' }] },
    { incidentId: `${prefix}2`, entities: [{ type: 'ip', address: '1.1.1.1' }] },
    { incidentId: `${prefix}3`, entities: [{ type: 'ip', address: '9.9.9.9' }] }
  ];

  return { prefix, incidents };
}

async function postIncidents(incidents) {
  for (const body of incidents) {
    const { response, payload } = await fetchJson(`${baseUrl}/api/v1/workflow/sentinel-replacement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    assert(response.status === 202, `Expected 202 for ${body.incidentId}, got ${response.status}`);
    assert(payload.incidentId === body.incidentId, `Response incidentId mismatch for ${body.incidentId}`);
  }
}

async function waitForPersistedRecords(prefix) {
  for (let i = 0; i < 50; i += 1) {
    const { response, payload } = await fetchJson(auditsUrl(prefix, '', Math.max(expectedCount, 20)), { method: 'GET' });
    assert(response.ok, `Audit fetch failed during wait: status=${response.status}`);

    if ((payload.count || 0) >= expectedCount) {
      return;
    }

    await sleep(250);
  }

  throw new Error('Timed out waiting for persisted integration-test audit records');
}

function collectIncidentIds(items) {
  return (items || []).map((item) => item.incidentId);
}

async function run() {
  await ensureHealth();

  const { prefix, incidents } = makeIncidents();
  const expectedIds = incidents.map((x) => x.incidentId).sort();

  await postIncidents(incidents);
  await waitForPersistedRecords(prefix);

  const { response: p1Resp, payload: page1 } = await fetchJson(auditsUrl(prefix), { method: 'GET' });
  assert(p1Resp.ok, `Page 1 failed: status=${p1Resp.status}`);
  assert(page1.count === 2, `Expected page1_count=2, got ${page1.count}`);
  assert(page1.hasMore === true, `Expected page1_hasMore=true, got ${String(page1.hasMore)}`);
  assert(Boolean(page1.nextCursor), 'Expected page1_nextCursor to be present');

  const { response: p2Resp, payload: page2 } = await fetchJson(auditsUrl(prefix, page1.nextCursor), {
    method: 'GET'
  });
  assert(p2Resp.ok, `Page 2 failed: status=${p2Resp.status}`);
  assert(page2.count === 1, `Expected page2_count=1, got ${page2.count}`);
  assert(page2.hasMore === false, `Expected page2_hasMore=false, got ${String(page2.hasMore)}`);

  const foundIds = [...collectIncidentIds(page1.items), ...collectIncidentIds(page2.items)];
  const uniqueFoundIds = Array.from(new Set(foundIds));
  const sortedFound = [...uniqueFoundIds].sort();

  assert(uniqueFoundIds.length === expectedCount, `Expected ${expectedCount} unique incident IDs, got ${uniqueFoundIds.length}`);
  assert(JSON.stringify(sortedFound) === JSON.stringify(expectedIds), `Expected IDs ${expectedIds.join(',')} but got ${sortedFound.join(',')}`);

  console.log('pagination-integration-test:PASS');
  console.log(`prefix=${prefix}`);
  console.log(`page1_ids=${collectIncidentIds(page1.items).join(',')}`);
  console.log(`page2_ids=${collectIncidentIds(page2.items).join(',')}`);
}

run().catch((error) => {
  console.error(`pagination-integration-test:FAIL ${error.message}`);
  process.exit(1);
});
