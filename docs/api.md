# Local API

Base URL: `http://127.0.0.1:4402`. Send JSON with `Content-Type: application/json`. Browser callers must use the dashboard origin.

| Method | Path                     | Behavior                                                       |
| ------ | ------------------------ | -------------------------------------------------------------- |
| GET    | `/api/health`            | Local status, network and stored count                         |
| GET    | `/api/scenarios`         | Available simulation IDs and labels                            |
| POST   | `/api/simulations`       | Run and save a fixture scenario                                |
| POST   | `/api/traces`            | Validate and save a completed captured lifecycle               |
| GET    | `/api/traces`            | Paginated traces, diagnostics and workspace statistics         |
| GET    | `/api/traces/:id`        | Trace and diagnosis                                            |
| GET    | `/api/traces/:id/export` | Download a versioned single-trace export                       |
| GET    | `/api/export`            | Download the workspace export                                  |
| POST   | `/api/devnet`            | Read an existing Devnet signature and save a chain observation |

## Simulate

```bash
curl http://127.0.0.1:4402/api/simulations \
  -H 'Content-Type: application/json' \
  -d '{"scenario":"delivery_failed","method":"GET","path":"/api/weather","amount":"10000"}'
```

Only `scenario` is required. Other fields default to the values above. Scenarios: `success`, `delivery_failed`, `verification_failed`, `settlement_failed`, `timeout`, `server_error`. All simulations are offline and return HTTP 201 after persistence.

## Capture

```json
{
  "request": { "method": "GET", "path": "/api/weather" },
  "payment": {
    "amount": "10000",
    "asset": "your-token-mint",
    "recipient": "your-recipient",
    "network": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
  },
  "events": [
    {
      "stage": "request",
      "status": "success",
      "atMs": 0,
      "durationMs": 5,
      "detail": "Request received."
    },
    {
      "stage": "challenge",
      "status": "success",
      "atMs": 5,
      "durationMs": 5,
      "detail": "Payment required.",
      "httpStatus": 402
    },
    {
      "stage": "verification",
      "status": "success",
      "atMs": 10,
      "durationMs": 40,
      "detail": "Verifier accepted payment."
    },
    {
      "stage": "settlement",
      "status": "success",
      "atMs": 50,
      "durationMs": 300,
      "detail": "Settlement confirmed."
    },
    {
      "stage": "delivery",
      "status": "failure",
      "atMs": 350,
      "durationMs": 15,
      "detail": "Resource handler failed.",
      "httpStatus": 500
    }
  ]
}
```

Capture rules:

- Send all five stages in order. After `failure`, `timeout` or `skipped`, skip every later stage.
- Use non-overlapping millisecond offsets, within 24 hours. Skipped stages take zero milliseconds.
- Use integer base-unit strings for amounts and Devnet CAIP-2 for the network.
- Paths must exclude query strings and whitespace. Use templates like `/api/orders/{id}` for private identifiers.
- Event details are limited to 500 characters. Redact secrets first; unknown fields are rejected.
- An optional `signature` is stored as unverified. Capture never calls the blockchain.

The response includes the derived outcome, diagnostics and `source: "capture"`.

## List and export

Query parameters: `q` (path, ID or signature search), `outcome`, `source`, `limit` (1 to 100, default 30), `offset` (0 to 1000). Newest stored traces appear first. `outcome` accepts `all`, `delivered`, `delivery_failed`, `payment_failed`, `timeout`, `error`, `observed`. `source` accepts `all`, `simulation`, `capture`, `devnet`.

```json
{
  "items": [],
  "total": 0,
  "nextOffset": null,
  "stats": { "total": 0, "delivered": 0, "issues": 0, "settledUndelivered": 0 }
}
```

Stats describe the whole workspace. Pagination is offset-based over a changing local list; concurrent insertions can shift pages. Exports contain `version: 1`, `exportedAt`, and either `trace` or `traces`. There is no import or delete endpoint.

## Devnet

```bash
curl http://127.0.0.1:4402/api/devnet \
  -H 'Content-Type: application/json' \
  -d '{"signature":"PASTE_AN_EXISTING_DEVNET_SIGNATURE"}'
```

This reads `getTransaction` at confirmed commitment, with parsed JSON and support for legacy, v0 and v1 transactions.

| State       | Meaning                                                              |
| ----------- | -------------------------------------------------------------------- |
| `confirmed` | Transaction executed without an on-chain error                       |
| `failed`    | Transaction has an on-chain error                                    |
| `not_found` | No confirmed result; it may be pending, pruned or on another cluster |
| `unknown`   | Transaction metadata is missing                                      |

This checks chain execution, not x402 recipient, mint, amount, authorization or delivery. RPC errors never count as confirmation. Limit: one check at a time, up to 12 per minute.

## Errors

Errors use `{ "error": { "code": "invalid_input", "message": "Check the request fields.", "details": [] } }`. Details, when present, contain paths and validation messages without rejected values.

| Status    | Meaning                                                         |
| --------- | --------------------------------------------------------------- |
| 400       | Invalid JSON                                                    |
| 403       | Foreign Origin, cross-site browser request or non-loopback Host |
| 404       | Unknown trace or route                                          |
| 409       | Local storage reached 1,000 traces                              |
| 413       | Body exceeds 64 KB                                              |
| 415       | POST is not JSON                                                |
| 422       | Schema validation failed                                        |
| 429       | Devnet check already running or attempt limit reached           |
| 500       | Local write or internal operation failed                        |
| 502 / 504 | Devnet RPC failed or could not be reached within its deadline   |
