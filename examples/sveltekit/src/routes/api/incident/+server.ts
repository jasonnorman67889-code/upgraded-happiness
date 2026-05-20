import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SOAR_URL = process.env.SOVEREIGN_SOAR_URL ?? 'http://localhost:3000';
const SOAR_TOKEN = process.env.SOVEREIGN_SOAR_TOKEN ?? '';

function authHeader() {
  return SOAR_TOKEN ? { authorization: `Bearer ${SOAR_TOKEN}` } : {};
}

export const GET: RequestHandler = async ({ url }) => {
  const limit = url.searchParams.get('limit') ?? '50';
  const cursor = url.searchParams.get('cursor') ?? '';
  const query = new URLSearchParams({ limit });
  if (cursor) {
    query.set('cursor', cursor);
  }

  const response = await fetch(`${SOAR_URL}/api/v1/audits?${query.toString()}`, {
    method: 'GET',
    headers: {
      ...authHeader()
    }
  });

  const data = await response.json();
  return json(data, { status: response.status });
};

export const POST: RequestHandler = async ({ request }) => {
  const payload = await request.json();

  const response = await fetch(`${SOAR_URL}/api/v1/workflow/sentinel-replacement`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeader()
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  return json(data, { status: response.status });
};
