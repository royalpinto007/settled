# Settled?

**See where an x402 payment went, and why the request still failed.**

A free, open-source, local-first payment debugger for Solana. Simulate the payment lifecycle without funds, capture events from your application, and inspect requests in a small developer dashboard.

![Settled? showing a settled payment with a failed resource delivery](docs/screenshot.png)

- Trace requests, 402 challenges, verification, settlement and delivery.
- Reproduce six success and failure scenarios without a wallet.
- Inspect timelines, diagnostics, transaction details and JSON evidence.
- Check an existing Solana Devnet transaction through the public RPC.
- Keep traces in local JSON files. No database, account, telemetry or paid API.

## Run locally

Requires **Node.js 22.18+** and npm. Node.js 24 is also supported.

```bash
git clone https://github.com/royalpinto007/settled.git
cd settled
npm install
npm run demo
```

Open **http://127.0.0.1:4402**. The first demo run seeds six fixture traces. Later runs preserve your data. Choose **New simulation**, select a scenario, and inspect its timeline. Use **Export** to save the selected trace or **Export all** for the workspace.

| Scenario              | Result                                               |
| --------------------- | ---------------------------------------------------- |
| Successful payment    | Payment settles and the resource is delivered        |
| Paid, delivery failed | Settlement succeeds, then delivery returns HTTP 500  |
| Verification rejected | Payment is rejected before settlement                |
| Settlement failed     | Verification succeeds, settlement fails              |
| Settlement timeout    | Confirmation deadline expires; outcome stays unknown |
| Server error          | HTTP 503 before a payment challenge                  |

Simulation timings are logical fixture durations. Simulated signatures start with `sim_` and are never sent to a blockchain. The sandbox does not sign or submit transactions.

## Capture your application

Send redacted lifecycle metadata to `POST /api/traces`. Run the included example while Settled? is running:

```bash
node examples/capture.mjs
node examples/capture.mjs delivery_failed
```

The example makes an actual HTTP 402 challenge and retry against an ephemeral local fixture resource. It records measured stage timings and sends the completed trace to the debugger. Its payment verifier and settlement are explicitly local fixtures, not a conforming x402 payment implementation. For a real integration, emit events around your x402 SDK and resource handler. See the [capture API](docs/api.md).

## Devnet inspector

Paste an existing Devnet signature into **Devnet inspector**. Settled? calls only `getTransaction` on `https://api.devnet.solana.com` at confirmed commitment. No key, wallet, faucet or funds are needed. The public RPC may throttle or be unavailable.

Confirmation reports chain execution. It does **not** prove the intended x402 recipient, mint, amount, authorization or resource delivery. It is stored as a separate chain observation and never upgrades a simulated payment into a real one. Production x402 verification belongs in a conforming SDK. See [Solana's x402 guide](https://solana.com/docs/payments/agentic-payments/x402) and [`getTransaction`](https://solana.com/docs/rpc/http/gettransaction).

## Configuration and storage

Defaults work without configuration. Optionally copy `.env.example` to `.env`; existing shell variables take precedence.

```bash
PORT=4403 DATA_DIR=./my-traces npm run demo
```

`npm run build && npm start` starts with an empty workspace rather than seeding demo data. The server binds to `127.0.0.1` only. Do not expose it through a tunnel or reverse proxy.

Data lives in `data/traces.json`, outside the static web directory and ignored by Git. Writes use a serialized queue, file sync and atomic rename. One process may open a data directory at a time. Storage stops at 1,000 traces rather than silently deleting evidence. Export, stop the server, archive the directory, then use a new `DATA_DIR` to continue. After a crash, a `.lock` file may remain; remove it only after verifying no instance is using that directory. Corrupt files are preserved and cause startup to fail.

Capture excludes headers, request/response bodies and query strings. You must redact free-text event details before sending them. JSON exports may contain the metadata you supplied. Back up or delete the data directory while the app is stopped.

## Development and verification

```bash
npm run check                  # format, lint, types, unit/API tests, build
npx playwright install chromium
npm run test:e2e               # desktop and mobile browser flows
npm audit
```

Tests use temporary directories and a local RPC fixture. They need no funds, API keys or internet access after dependencies and Chromium are installed. `npm run dev` watches the server after building dashboard assets; rebuild after editing the dashboard.

Built with TypeScript, Node.js, Express and a vanilla TypeScript dashboard bundled with esbuild. [Architecture and diagram](docs/architecture.md) · [API reference](docs/api.md) · [Contributing](CONTRIBUTING.md).

Licensed under [MIT](LICENSE). The package is marked private and is not published on npm.
