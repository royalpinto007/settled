# MVP scope and implementation

Settled? helps developers distinguish payment failures from delivery failures without spending funds. One Node.js process serves a TypeScript dashboard and Express API. Files remain on the user's machine.

1. Build and test a typed trace model, diagnostics and six deterministic simulation scenarios. Treat simulated settlement as a fixture, never chain evidence.
2. Add atomic, serialized JSON persistence, validated capture and export APIs, and a fixed-endpoint, read-only Devnet adapter. Test corruption, concurrent writes, hostile browser origins and malformed RPC responses.
3. Build an accessible request list and inspector with filtering, timelines, transaction details, JSON exports and simulation controls. Test user flows in a real browser at desktop and mobile widths.
4. Document the capture contract, architecture, commands and limits. Run formatter, lint, type checks, tests, build and dependency audit. Create the requested public GitHub repository and push focused conventional commits.

Use a system sans-serif stack for navigation and monospace for protocol evidence. Palette: canvas `#101218`, panel `#191c25`, border `#303542`, text `#edf0f7`, violet `#b7a3ff`, success `#79d6b0`. A compact sidebar frames a request table and a detailed inspector. Status always has text as well as color.

No database, login, cloud service, signing keys, wallet connection, transaction submission, arbitrary outbound URLs or npm publication. Capture normalized metadata only, never authorization headers or bodies. Devnet confirms chain execution only; it does not validate x402 recipient, mint, amount or delivery. JSON storage supports one application process with a startup lock and a bounded trace count. Demo seeding is idempotent and never replaces existing traces.
