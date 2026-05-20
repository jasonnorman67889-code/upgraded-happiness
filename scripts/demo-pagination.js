const baseUrl = process.env.SOAR_BASE_URL || 'http://localhost:3000';
const limit = Number(process.env.SOAR_AUDIT_LIMIT || 2);
const expectedDemoRecords = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function ensureApiReady() {
  const { response, payload } = await fetchJson(`${baseUrl}/health`, { method: 'GET' });
  if (!response.ok || !payload.ok) {
    throw new Error(`Health check failed: status=${response.status}`);
  }
}

async function postDemoIncidents() {
  const suffix = Date.now();
  const prefix = `INC-DEMO-${suffix}-`;
  const incidents = [
    { incidentId: `${prefix}1`, entities: [{ type: 'ip', address: '8.8.8.8' }] },
    { incidentId: `${prefix}2`, entities: [{ type: 'ip', address: '1.1.1.1' }] },
    { incidentId: `${prefix}3`, entities: [{ type: 'ip', address: '9.9.9.9' }] }
  ];

  for (const body of incidents) {
    const { response } = await fetchJson(`${baseUrl}/api/v1/workflow/sentinel-replacement`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    console.log(`post ${body.incidentId} -> ${response.status}`);
  }

  return prefix;
}

function auditsUrl(auditLimit, incidentPrefix, cursor) {
  const query = new URLSearchParams({
    limit: String(auditLimit),
    incidentPrefix
  });

  if (cursor) {
    query.set('cursor', cursor);
  }

  return `${baseUrl}/api/v1/audits?${query.toString()}`;
}

async function waitForDemoRecords(incidentPrefix) {
  for (let i = 0; i < 40; i += 1) {
    const { payload } = await fetchJson(auditsUrl(50, incidentPrefix), { method: 'GET' });
    if ((payload.count || 0) >= expectedDemoRecords) {
      return;
    }

    await sleep(250);
  }

  throw new Error('Expected demo audit records were not available after waiting for worker processing.');
}

async function run() {
  await ensureApiReady();
  const incidentPrefix = await postDemoIncidents();
  console.log(`incidentPrefix=${incidentPrefix}`);

  await waitForDemoRecords(incidentPrefix);

  const { payload: page1 } = await fetchJson(auditsUrl(limit, incidentPrefix), { method: 'GET' });
  console.log(`page1_count=${page1.count}`);
  console.log(`page1_hasMore=${Boolean(page1.hasMore)}`);
  console.log(`page1_nextCursor=${page1.nextCursor || ''}`);
  (page1.items || []).forEach((item) => {
    console.log(`page1_item=${item.incidentId}`);
  });

  if (!page1.nextCursor) {
    return;
  }

  const { payload: page2 } = await fetchJson(auditsUrl(limit, incidentPrefix, page1.nextCursor), { method: 'GET' });

  console.log(`page2_count=${page2.count || 0}`);
  console.log(`page2_hasMore=${Boolean(page2.hasMore)}`);
  console.log(`page2_nextCursor=${page2.nextCursor || ''}`);
  (page2.items || []).forEach((item) => {
    console.log(`page2_item=${item.incidentId}`);
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
