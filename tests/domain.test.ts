import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulate,
  scenarios,
  diagnose,
  captureSchema,
} from "../src/domain/trace.js";

test("successful simulation includes the complete x402 lifecycle without a real signature", () => {
  const trace = simulate({ scenario: "success" });
  assert.equal(trace.source, "simulation");
  assert.equal(trace.outcome, "delivered");
  assert.equal(trace.events.length, 5);
  assert.equal(trace.events[1]?.httpStatus, 402);
  assert.equal(trace.events.at(-1)?.httpStatus, 200);
  assert.match(trace.transaction!.signature, /^sim_/);
});

test("every failure scenario stops at the correct stage and has actionable diagnostics", () => {
  for (const scenario of scenarios.filter((item) => item !== "success")) {
    const trace = simulate({ scenario });
    assert.notEqual(trace.outcome, "delivered");
    assert.ok(diagnose(trace).advice.length > 20);
    const failedIndex = trace.events.findIndex((event) =>
      ["failure", "timeout"].includes(event.status),
    );
    assert.ok(failedIndex >= 0);
    assert.ok(
      trace.events
        .slice(failedIndex + 1)
        .every((event) => event.status === "skipped"),
    );
  }
  const paid = simulate({ scenario: "delivery_failed" });
  assert.equal(paid.events[3]?.status, "success");
  assert.match(diagnose(paid).title, /settled/i);
});

test("capture rejects duplicate, unordered or impossible lifecycle events and query secrets", () => {
  const { request, payment, events } = simulate({ scenario: "success" });
  assert.equal(
    captureSchema.safeParse({ request, payment, events }).success,
    true,
  );
  assert.equal(
    captureSchema.safeParse({ request, payment, events: [...events].reverse() })
      .success,
    false,
  );
  const impossible = structuredClone(events);
  impossible[2]!.status = "failure";
  assert.equal(
    captureSchema.safeParse({ request, payment, events: impossible }).success,
    false,
  );
  assert.equal(
    captureSchema.safeParse({
      request: { ...request, path: "/data?token=secret" },
      payment,
      events,
    }).success,
    false,
  );
});
