# Lippy Agent

Backend infrastructure for reliable structured web extraction. Define a URL and typed contract; a separate worker extracts data, validates it, repairs broken selectors, verifies changes and publishes durable events. REST and MCP share the same authenticated service layer.

## Run locally

Requires Node.js 22+ and PostgreSQL. Docker is optional if you already have PostgreSQL.

```sh
npm ci
cp .env.example .env
docker compose up -d db
npm run db:generate
npm run db:deploy
npm run dev
# In another terminal:
npm run worker
```

Fill `.env` using the explanations in `.env.example`. For a zero-API-key local demonstration, set `AUTH_MODE=development` and `EXTRACTION_PROVIDER=fixture`, then run `npm run demo` with the API and worker running. Development authentication never works with `NODE_ENV=production`. The demo creates a disabled contract, verifies a baseline, changes its HTML, proves selector recovery, and quarantines a suspicious price change while retaining accepted data. Fixture data is isolated per contract and stored in PostgreSQL, not in process-global flags.

For real extraction set `EXTRACTION_PROVIDER=brightdata` and `BRIGHTDATA_API_KEY`. Supply an existing **dedicated batch-mode** Scraper Studio `collectorId` per contract, or set `BRIGHTDATA_DELIVERY_EMAIL` to let the worker create and generate a collector. Newly created collectors also deliver results to that email. Field names/types must match an existing collector's output. Contracts currently represent one page and exactly one output record.

## Google OAuth and API tokens

1. Create a Google OAuth web application and copy its client ID/secret into `.env`.
2. Register `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI. In deployment use the HTTPS `APP_URL` and its corresponding callback.
3. With `AUTH_MODE=google`, open `/api/auth/google` in your browser. A successful login redirects to `/api/auth/me` and sets an HttpOnly session cookie.
4. From that same origin, request an API token:

```js
await fetch('/api/auth/tokens', { method: 'POST' }).then(r => r.json())
```

The returned token is shown once; store it securely. REST and MCP clients send `Authorization: Bearer TOKEN`. API tokens expire after 30 days, sessions after 7 days. Delete a token with `DELETE /api/auth/tokens` and JSON `{ "id": "TOKEN_ID" }`. Log out with `POST /api/auth/logout`. Cookie-authenticated writes require the matching `Origin`; bearer clients do not. Cross-origin requests are rejected. Google login uses one-time state, PKCE, nonce and signature/issuer/audience verification. Only token hashes are stored.

## REST example

In development-auth mode omit the Authorization header. Set TOKEN in your shell for Google mode.

```sh
curl -X POST http://localhost:3000/api/contracts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/product","enabled":false,"fields":[
    {"key":"product","type":"string","expectedValue":"Example product"},
    {"key":"price","type":"number","minimum":0,"maxRelativeChange":0.5}
  ]}'

curl -X POST http://localhost:3000/api/contracts/CONTRACT_ID/run \
  -H "Authorization: Bearer $TOKEN" -H 'Idempotency-Key: first-run'
# 202 + {runId, state}; Location points to /api/runs/RUN_ID.

curl http://localhost:3000/api/runs/RUN_ID -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/api/contracts/CONTRACT_ID/data -H "Authorization: Bearer $TOKEN"
curl -N http://localhost:3000/api/contracts/CONTRACT_ID/events \
  -H "Authorization: Bearer $TOKEN" -H 'Accept: text/event-stream'
```

| Endpoint | Behavior |
| --- | --- |
| `GET/POST /api/contracts` | List/create owned contracts |
| `GET /api/contracts/:id` | Contract, recent runs and initial event history |
| `PATCH /api/contracts/:id` | Pause/resume scheduling using `{"enabled":false/true}` |
| `POST /api/contracts/:id/run` | Enqueue; optional `Idempotency-Key` deduplicates retries |
| `GET /api/runs/:id` | State, raw/validated output, violations, provider job ID and repair history |
| `GET /api/contracts/:id/data` | Last accepted data and its run/timestamp; includes current health |
| `GET /api/contracts/:id/events?after=SEQUENCE` | Durable event pages; SSE with `Accept: text/event-stream` |
| `POST /api/runs/:id/review` | `{"decision":"accept"}` or `{"decision":"reject"}` for quarantined results |
| `POST /api/runs/:id/reconcile` | Record manual reconciliation of an indeterminate provider submission |
| `POST /api/dev/break` | Non-production fixture mutation: `{contractId, scenario:"layout"}`; also `value` with `field`/`value`, or `unrepairable` |
| `GET /api/health` | Database readiness |

Review and reconciliation leave scheduling paused. Explicitly resume it after resolving the problem. The reconciliation request requires a descriptive `note`; it can attach `collectorId` after you identify a scraper created during an interrupted request. Verify/cancel outstanding provider work in Scraper Studio before reconciling.

## MCP

Connect a Streamable HTTP MCP client to `/api/mcp` with an API bearer token. Available tools: `create_contract`, `list_contracts`, `run_contract`, `get_run`, `get_data`, `watch_contract`. `watch_contract` now reads durable events after a cursor; it does not trigger extraction. Tool calls are stateless JSON responses. Event streaming uses the REST SSE endpoint, with `Last-Event-ID` for reconnect replay. API tokens are configured explicitly; this server does not implement MCP OAuth discovery/dynamic client registration.

## Verification and guarantees

- PostgreSQL stores queued work, state transitions, raw output, repair attempts and events. Multiple workers claim jobs with `FOR UPDATE SKIP LOCKED`, expiring leases and fencing tokens. One active run per contract is serialized with a database row lock.
- Each bounded step releases its lease. Polling states survive restarts and read failures use bounded backoff. All runs have a deadline and repair budget. Repeated or unrecoverable failures pause scheduling.
- State and event writes share a transaction. Publishers serialize per contract before allocating event sequences, so a cursor cannot skip a later-committing earlier event. Each SSE/MCP subscriber owns its cursor. This is PostgreSQL-backed pub/sub; it does not depend on Redis or process-local fanout.
- A crash between a non-idempotent provider request and storing its response is **indeterminate**, not silently retried. Exactly-once external side effects are not claimed.
- Schema verification supports required fields, types, numeric bounds and expected identity/value. Semantic difference verification uses explicit normalization (Unicode/whitespace, optional case folding, URL canonicalization) and numeric relative-change limits. It reports initialization, meaningful changes and suspicious changes under those rules. It is not general-purpose AI truth verification. `confidence: 1` means the rule matched deterministically, not that a model proved source accuracy.
- Bright Data repair is approved and saved upstream, then the extraction is run again. Only verified data is promoted locally. The integration does not offer isolated candidate scrapers or automatic upstream rollback. Fields without identity/bounds constraints can still contain semantically wrong but type-valid data.
- No live Bright Data or Google login is claimed as tested without real credentials. Provider protocol tests use documented response fixtures. Removed the previous undocumented Parallel AI diff endpoint and silent "no change" fallback.

See [architecture and failure walkthrough](docs/architecture.md).

## Tests and deployment

```sh
npm run lint
npm run typecheck
npm test
# Explicitly use a dedicated migrated TEST database:
DATABASE_URL=postgresql://user:password@localhost:5432/lippy_test RUN_DB_TESTS=1 npm test
npm run build
npm start
# Separate long-running worker process, with the same .env:
npm run worker
```

The CI workflow provisions PostgreSQL, applies migrations, runs unit/integration tests and builds the API. Deploy the API and at least one worker against the same database. Use HTTPS, `AUTH_MODE=google`, and configure secrets on both processes. Polling subscriptions need a hosting environment that allows streaming connections; long extraction jobs execute only in workers.

For an existing database already matching the old schema, back it up and mark the baseline migration applied before deploying the second migration:

```sh
npx prisma migrate resolve --applied 202609140001_baseline
npm run db:deploy
```

Legacy history is preserved, legacy interrupted runs are closed, and unowned contracts are paused and inaccessible until deliberately assigned to a user. Legacy mock collector IDs are cleared. Duplicate real collector IDs must be resolved before migration because each contract now requires a dedicated collector.
