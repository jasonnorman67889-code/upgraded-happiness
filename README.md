# Sovereign-SOAR

[![CI](https://github.com/jasonnorman67889-code/upgraded-happiness/actions/workflows/ci.yml/badge.svg)](https://github.com/jasonnorman67889-code/upgraded-happiness/actions/workflows/ci.yml)

Node.js microservice replacement for Azure Logic App playbooks:
- PB-Enrich-GeoIP
- PB-Campaign-AutoMerge

## Features
- Express webhook ingress
- BullMQ async queue
- Redis-backed idempotency and correlation state
- Optional Postgres audit persistence for enrichment and workflow decisions
- JWT middleware (disabled, HS256, or JWKS)
- Worker-based enrichment and auto-merge processing
- Redis pub/sub event output for HUD integration
- WebSocket HUD stream at `/ws/hud`
- JWKS key generation, token minting, and smoke test tooling

## Quick Start (Docker)
1. Copy environment file:
   - `copy .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`)
2. Start services:
   - `docker compose up --build`
3. Health check:
   - `GET http://localhost:3000/health`
4. Host service ports:
   - Redis: `127.0.0.1:6380`
   - Postgres: `127.0.0.1:55432`

## Quick Start (Local Node)
1. Run Redis locally on port 6380 (matches `.env.example`).
2. Run Postgres locally on port 55432 (matches `.env.example`, or clear `DATABASE_URL` to skip persistence).
3. Copy env file:
   - `Copy-Item .env.example .env`
4. Start API:
   - `npm run dev:api`
5. Start worker in another terminal:
   - `npm run dev:worker`

## Test Request
```bash
curl -X POST http://localhost:3000/api/v1/workflow/sentinel-replacement \
  -H "Content-Type: application/json" \
  -d "{\"incidentId\":\"INC-1001\",\"entities\":[{\"type\":\"ip\",\"address\":\"8.8.8.8\"}]}"
```

## API
- `POST /api/v1/workflow/sentinel-replacement`
- `GET /api/v1/audits?limit=100&cursor=<token>&incidentPrefix=INC-DEMO-...`
- `GET /health`

Audit pagination response includes:
- `items`
- `hasMore`
- `nextCursor`

Optional audit filter:
- `incidentPrefix`: returns only records where `incidentId` starts with the provided prefix.

## Security
- `JWT_MODE=disabled`: no auth checks
- `JWT_MODE=hs256`: verifies bearer token with `JWT_SECRET`
- `JWT_MODE=jwks`: verifies RS256 with `JWKS_URI`

## WebSocket HUD Stream
- Endpoint: `ws://localhost:3000/ws/hud`
- Broadcast source: worker publishes result envelopes via Redis pub/sub.
- If `WS_JWT_REQUIRED=true`, connect with query token:
   - `ws://localhost:3000/ws/hud?token=<jwt>`

## JWKS Tooling
1. Generate dev RSA/JWKS material:
   - `npm run keys:generate`
2. Mint a JWT signed with generated private key:
   - `npm run jwt:mint`
3. Run JWKS middleware smoke test:
   - `npm test`

Generated key files are written to `devkeys/`.

## Postman And Seed Payloads
- Postman collection: `examples/postman/Sovereign-SOAR.postman_collection.json`
- Postman environment: `examples/postman/Sovereign-SOAR.postman_environment.json`
- Seed incident payloads:
  - `examples/seed/incident-basic.json`
  - `examples/seed/incident-merge-candidate.json`

## One-Command Pagination Demo
- Run:
   - `npm run demo:pagination`
- Optional overrides:
   - `SOAR_BASE_URL` (default: `http://localhost:3000`)
   - `SOAR_AUDIT_LIMIT` (default: `2`)
- Output includes posted incident statuses and page 1/page 2 cursor results.
- Demo is deterministic: it queries only records for its generated `incidentPrefix`.

## Integration Test (CI-Friendly)
- Assertion-based pagination test:
   - `npm run test:integration:pagination`
- Combined smoke + integration suite:
   - `npm run test:ci`
- The integration test verifies:
   - exactly 3 run-scoped incidents are posted
   - page 1 returns 2 records with `hasMore=true`
   - page 2 returns 1 record with `hasMore=false`
   - combined page IDs exactly match the posted run-scoped IDs

## GitHub Actions CI
- Workflow: `.github/workflows/ci.yml`
- Triggers: `push`, `pull_request`
- CI provisions Redis + Postgres service containers, starts API/worker, waits for `/health`, and runs `npm run test:ci`.

## Troubleshooting CI
- API health check timeout:
   - Inspect `api.log` artifact in failed workflow output.
   - Ensure `PORT=3000` and no startup crash from missing env values.
- Integration test timeout waiting for audit records:
   - Inspect `worker.log` in failed workflow output.
   - Confirm worker can reach Redis/Postgres using CI env URLs.
- Postgres auth/connect failures:
   - Verify CI service credentials match `postgres/postgres` and DB `sovereign_soar`.
   - Verify `DATABASE_URL` in workflow points to `127.0.0.1:5432`.
- Redis version/connection errors:
   - Confirm CI service image is `redis:7-alpine`.
   - Verify `REDIS_URL=redis://127.0.0.1:6379` in workflow.
- Badge not rendering:
   - Replace `OWNER/REPO` in README badge URL with your actual GitHub org/user and repository name.

## SvelteKit Live HUD Example
- API proxy endpoint:
   - `examples/sveltekit/src/routes/api/incident/+server.ts`
- Live stream page:
   - `examples/sveltekit/src/routes/hud/+page.svelte`
- Bootstrap behavior:
   - Loads recent history first from `/api/incident?limit=20` (proxy to `/api/v1/audits`), then appends live websocket events.
   - Uses cursor pagination for older records via `nextCursor`.

## SvelteKit Integration Sample
See:
- `examples/sveltekit/src/routes/api/incident/+server.ts`

Set:
- `SOVEREIGN_SOAR_URL`
- `SOVEREIGN_SOAR_TOKEN`

## Notes
- `services/enrichment.js` currently uses `ip-api.com` as a placeholder.
- Replace with your sovereign intel source as needed.
# upgraded-happiness
