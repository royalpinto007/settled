# Local API

Base URL: `http://127.0.0.1:4402`. POST requests require `Content-Type: application/json`. All data is local. Browser callers must share the dashboard origin; server-side clients may call loopback directly.

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

Supply exactly five events, in this order. Status is `success`, `failure`, `timeout` or `skipped`. After any failure, timeout or skipped stage, all later stages must be skipped. Offsets must not overlap and the timeline must fit within 24 hours. Use `durationMs: 0` for unattempted stages. The server derives the outcome and returns the stored trace with `source: "capture"` and diagnostics.

An optional top-level `signature` is a base58 Solana signature, stored as unverified (`state: "unknown"`). No RPC call occurs during capture. Use the Devnet endpoint to make an independent chain observation. Only Devnet CAIP-2 is accepted in this MVP. Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

Paths must be root-relative route paths without query strings, whitespace or credentials. Use route templates such as `/api/orders/{id}` for sensitive identifiers. Amount is a string of 1 to 20 decimal digits in token base units, not a floating-point currency value. `asset` is a mint address or explicit fixture label; it is metadata, not an allowlist or payment validation result. Details are limited to 500 characters. Unknown keys are rejected. Never include raw headers, bodies, secrets or signed payloads. The debugger cannot automatically redact secrets you place in event details.

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

The fixed public endpoint calls `getTransaction` with `commitment: "confirmed"`, `encoding: "jsonParsed"`, `maxSupportedTransactionVersion: 1`. This supports legacy, v0 and v1 transaction observations, following [Solana's versioned transaction guidance](https://solana.com/developers/cookbook/transactions/versions). A matching result with `meta.err: null` produces `confirmed`; a transaction error produces `failed`; a null result produces `not_found`; missing metadata produces `unknown`. Responses are size-limited and checked against a schema. Unsupported transaction versions, malformed responses and RPC outages produce an error. A timeout is never interpreted as payment failure.

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
