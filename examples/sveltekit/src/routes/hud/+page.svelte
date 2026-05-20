<script lang="ts">
  import { onMount } from 'svelte';

  type HudEnvelope = {
    eventName: string;
    payload: {
      incidentId?: string;
      enrichment?: {
        status?: string;
        data?: {
          location?: string;
          coordinates?: { lat?: number; lon?: number };
        };
      };
      workflowAction?: {
        action?: string;
        campaignId?: string;
        targetId?: string;
      };
      processedAt?: string;
    };
    publishedAt: string;
  };

  let socketState = 'connecting';
  let events: HudEnvelope[] = [];
  let nextCursor = '';
  let hasMore = false;
  let loadingHistory = false;
  const wsToken = '';
  const apiToken = '';

  async function loadHistory(mode: 'replace' | 'append' = 'replace') {
    loadingHistory = true;
    const query = new URLSearchParams({ limit: '20' });
    if (mode === 'append' && nextCursor) {
      query.set('cursor', nextCursor);
    }

    const response = await fetch(`/api/incident?${query.toString()}`, {
      headers: {
        ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {})
      }
    });

    if (!response.ok) {
      loadingHistory = false;
      return;
    }

    const payload = await response.json();
    nextCursor = payload.nextCursor ?? '';
    hasMore = Boolean(payload.hasMore);

    const historic = (payload.items ?? []).map((item: any) => ({
      eventName: 'incident.historic',
      payload: {
        incidentId: item.incidentId,
        enrichment: item.enrichment,
        workflowAction: item.workflowAction,
        processedAt: item.processedAt
      },
      publishedAt: item.processedAt
    })) as HudEnvelope[];

    events = mode === 'append' ? [...events, ...historic] : historic;
    loadingHistory = false;
  }

  onMount(() => {
    loadHistory();

    const url = new URL('/ws/hud', window.location.origin.replace('http', 'ws'));
    if (wsToken) {
      url.searchParams.set('token', wsToken);
    }

    const ws = new WebSocket(url.toString());

    ws.onopen = () => {
      socketState = 'open';
    };

    ws.onclose = () => {
      socketState = 'closed';
    };

    ws.onerror = () => {
      socketState = 'error';
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as HudEnvelope;
      events = [parsed, ...events].slice(0, 200);
    };

    return () => ws.close();
  });
</script>

<svelte:head>
  <title>Sovereign HUD Stream</title>
</svelte:head>

<main>
  <h1>Sovereign HUD Live Stream</h1>
  <p>Socket status: {socketState}</p>
  <button on:click={() => loadHistory('append')} disabled={!hasMore || loadingHistory}>
    {loadingHistory ? 'Loading...' : hasMore ? 'Load older history' : 'No more history'}
  </button>

  <ul>
    {#each events as evt}
      <li>
        <strong>{evt.eventName}</strong>
        <div>Incident: {evt.payload.incidentId ?? 'n/a'}</div>
        <div>
          Geo: {evt.payload.enrichment?.data?.location ?? 'n/a'}
          ({evt.payload.enrichment?.data?.coordinates?.lat ?? 'n/a'}, {evt.payload.enrichment?.data?.coordinates?.lon ?? 'n/a'})
        </div>
        <div>
          Action: {evt.payload.workflowAction?.action ?? 'n/a'}
          {evt.payload.workflowAction?.campaignId ?? evt.payload.workflowAction?.targetId ?? ''}
        </div>
        <small>{evt.publishedAt}</small>
      </li>
    {/each}
  </ul>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: 'IBM Plex Sans', sans-serif;
    background: radial-gradient(circle at top left, #0b2b3a, #07151d 60%, #02070a);
    color: #e6f8ff;
  }

  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  h1 {
    font-size: clamp(1.4rem, 2.5vw, 2.2rem);
    margin-bottom: 0.2rem;
  }

  p {
    opacity: 0.85;
    margin-top: 0;
  }

  ul {
    list-style: none;
    margin: 1rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.8rem;
  }

  li {
    background: rgba(10, 31, 41, 0.7);
    border: 1px solid rgba(116, 200, 221, 0.28);
    border-radius: 12px;
    padding: 0.8rem;
    backdrop-filter: blur(3px);
  }

  small {
    opacity: 0.72;
  }
</style>
