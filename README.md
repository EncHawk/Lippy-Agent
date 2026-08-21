# Web Contracts

Websites change. Your API shouldn't. See [`SPEC.md`](./SPEC.md) for the full
architecture, judging-criteria mapping, and demo script.

## Setup

```bash
npm install
cp .env.example .env      # works out of the box in mock mode, no keys needed
npm run db:generate
npm run db:migrate
npm run dev
```

Runs fully in **mock mode** with zero API keys — `BrightDataClient` and
`ParallelClient` both fall back to deterministic mock responses so the
create → run → violate → heal → verify → semantic-diff loop is runnable
end to end out of the box. Set `BRIGHTDATA_API_KEY` / `PARALLEL_API_KEY` in
`.env` to hit the real APIs.

## Project layout

```
src/
  app/                    Next.js App Router — routes are thin adapters only
    api/contracts/        REST surface (create, get, run, live event stream)
    api/mcp/              MCP server over Streamable HTTP
  lib/
    contracts/            schema (Zod), validator, service layer
    brightdata/           typed client (create/run/heal/approve), mock-capable
    parallel/              semantic-diff client, mock-capable
    selfheal/              the orchestrator state machine
    events/                typed event union + pub/sub bus
    env.ts errors.ts logger.ts db.ts
  mcp/server.ts            tool definitions (create_contract, watch_contract, get_data)
  tests/                   vitest unit tests
prisma/schema.prisma       Contract / Run / ContractEvent models
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:studio` | Browse the SQLite DB visually |

## Try it

```bash
# create a contract
curl -X POST localhost:3000/api/contracts -H 'content-type: application/json' -d '{
  "url": "https://example.com/product",
  "fields": [
    { "key": "product", "type": "string", "required": true },
    { "key": "price", "type": "number", "required": true },
    { "key": "stock", "type": "boolean", "required": false }
  ]
}'

# trigger a run (mock mode breaks the extraction every 3rd call, so re-run
# a few times to see contract.violated -> contract.healing -> contract.healed)
curl -X POST localhost:3000/api/contracts/<id>/run
```
