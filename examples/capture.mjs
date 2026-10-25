import { createServer } from "node:http";
import { once } from "node:events";

// This fixture demonstrates instrumentation, not cryptographic x402 validation.
const scenario = process.argv[2] ?? "success";
if (!["success", "delivery_failed"].includes(scenario))
  throw new Error("Use success or delivery_failed.");
const debuggerUrl = new URL(process.env.SETTLED_URL || "http://127.0.0.1:4402");
if (
  debuggerUrl.protocol !== "http:" ||
  !["127.0.0.1", "localhost"].includes(debuggerUrl.hostname) ||
  debuggerUrl.username ||
  debuggerUrl.password
)
  throw new Error("SETTLED_URL must be an HTTP loopback URL.");
const events = [];
const started = performance.now();
let previousEnd = 0;
function record(stage, status, detail, httpStatus) {
  const end = Math.max(previousEnd, Math.round(performance.now() - started));
  events.push({
    stage,
    status,
    atMs: previousEnd,
    durationMs: end - previousEnd,
    detail,
    ...(httpStatus ? { httpStatus } : {}),
  });
  previousEnd = end;
}
const resource = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.headers["x-settled-fixture"] !== "local-only") {
    record(
      "request",
      "success",
      "HTTP request received by the local fixture resource.",
    );
    res.writeHead(402);
    res.end(
      JSON.stringify({
        fixture: true,
        message:
          "Payment required. This sandbox accepts only the X-Settled-Fixture marker.",
      }),
    );
    record(
      "challenge",
      "success",
      "Local fixture returned HTTP 402. No payment payload was requested.",
      402,
    );
    return;
  }
  record(
    "verification",
    "success",
    "Fixture marker accepted. No signature was verified.",
  );
  record(
    "settlement",
    "success",
    "Local fixture settlement completed. No transaction was submitted.",
  );
  const status = scenario === "delivery_failed" ? 500 : 200;
  res.writeHead(status);
  res.end(
    JSON.stringify({
      fixture: true,
      ...(status === 200
        ? { weather: "sunny" }
        : { error: "Resource handler failed after fixture payment." }),
    }),
  );
  record(
    "delivery",
    status === 200 ? "success" : "failure",
    status === 200
      ? "Resource returned over HTTP."
      : "Resource returned HTTP 500 after fixture settlement.",
    status,
  );
});
resource.listen(0, "127.0.0.1");
await once(resource, "listening");
try {
  const { port } = resource.address();
  const url = `http://127.0.0.1:${port}/resource`;
  const challenge = await fetch(url, { signal: AbortSignal.timeout(5000) });
  await challenge.json();
  if (challenge.status !== 402) throw new Error("Expected a 402 challenge.");
  const delivery = await fetch(url, {
    headers: { "X-Settled-Fixture": "local-only" },
    signal: AbortSignal.timeout(5000),
  });
  await delivery.json();
  const response = await fetch(new URL("/api/traces", debuggerUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      request: { method: "GET", path: "/example/resource" },
      payment: {
        amount: "10000",
        asset: "USDC (fixture)",
        recipient: "sandbox-recipient",
        network: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
      },
      events,
    }),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      `Capture failed with HTTP ${response.status}. Check that Settled? is running.`,
    );
  const trace = await response.json();
  console.log(
    `Captured ${trace.id}: ${trace.outcome}. Open ${debuggerUrl.origin} to inspect it.`,
  );
} finally {
  await new Promise((resolve) => resource.close(resolve));
}
