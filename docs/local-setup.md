# Local setup

Defaults work without configuration. Optionally copy `.env.example` to `.env`. Shell variables take precedence.

## Run options

```bash
PORT=4403 DATA_DIR=./my-traces npm run demo
```

- `npm run demo`: build and seed six examples if storage is empty.
- `npm run build && npm start`: run without seeding. Existing traces stay intact.
- `npm run dev`: watch the server. Rebuild after dashboard edits.

## Storage

Traces live in `data/traces.json`, outside the web directory and ignored by Git.

- One process per data directory; writes are serialized and atomically replaced.
- Storage stops at 1,000 traces. Export, stop the app, archive the directory, and choose a new `DATA_DIR`.
- After a crash, remove `.lock` only after confirming no instance is running.
- Corrupt files cause startup to fail and remain untouched. Back them up before repair.

## Privacy

Run on a trusted workstation. Do not expose the loopback server through a tunnel or proxy.

Capture accepts metadata, not raw headers, bodies or query strings. Redact event details before sending them. Exports contain the metadata you supplied. Back up or delete data only while the app is stopped.

## Verify changes

```bash
npm run check
npx playwright install chromium
npm run test:e2e
npm audit
```

Tests use temporary data and local RPC fixtures. They need no funds or keys.
