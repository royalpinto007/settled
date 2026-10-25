import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { JsonStore } from "../src/adapters/store.js";
import { createApp } from "../src/app.js";
import { simulate } from "../src/domain/trace.js";

test("API simulates, filters, captures and exports persistent traces", async () => {
  const dir = await mkdtemp(join(tmpdir(), "settled-api-"));
  const store = new JsonStore(dir);
  await store.open();
  const app = createApp(store);
  try {
    const created = await request(app)
      .post("/api/simulations")
      .send({ scenario: "delivery_failed" })
      .expect(201);
    assert.equal(created.body.outcome, "delivery_failed");
    assert.equal(
      created.body.diagnostic.title,
      "Payment settled. Delivery failed.",
    );
    const list = await request(app)
      .get("/api/traces?outcome=delivery_failed&limit=1")
      .expect(200);
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.total, 1);
    assert.equal(
      (await request(app).get("/api/traces?q=nothingmatches")).body.items
        .length,
      0,
    );
    const exported = await request(app)
      .get(`/api/traces/${created.body.id}/export`)
      .expect(200);
    assert.match(exported.headers["content-disposition"]!, /attachment/);
    assert.equal(exported.body.trace.id, created.body.id);
    assert.equal(exported.body.version, 1);
    const { request: req, payment, events } = simulate({ scenario: "success" });
    const capture = await request(app)
      .post("/api/traces")
      .send({ request: req, payment, events })
      .expect(201);
    assert.equal(capture.body.source, "capture");
    await request(app).get(`/api/traces/${capture.body.id}`).expect(200);
    const all = await request(app).get("/api/export").expect(200);
    assert.equal(all.body.traces.length, 2);
    await request(app).get("/api/traces/../../.env").expect(404);
    await request(app).get("/api/traces/not-a-uuid").expect(422);
    await request(app).get("/api/traces?limit=1001").expect(422);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("API blocks hostile origins, DNS rebinding, unknown fields and oversized or malformed bodies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "settled-api-"));
  const store = new JsonStore(dir);
  await store.open();
  const app = createApp(store);
  try {
    await request(app)
      .get("/api/traces")
      .set("Host", "attacker.example")
      .expect(403);
    await request(app)
      .post("/api/simulations")
      .set("Origin", "https://attacker.example")
      .send({ scenario: "success" })
      .expect(403);
    await request(app)
      .post("/api/simulations")
      .send({ scenario: "success", privateKey: "never-store-this" })
      .expect(422);
    await request(app)
      .post("/api/simulations")
      .type("json")
      .send("{bad")
      .expect(400);
    await request(app)
      .post("/api/simulations")
      .send({ scenario: "success", payload: "a".repeat(70000) })
      .expect(413);
    await request(app)
      .post("/api/simulations")
      .type("form")
      .send("scenario=success")
      .expect(415);
    const health = await request(app).get("/api/health").expect(200);
    assert.match(
      health.headers["content-security-policy"]!,
      /default-src 'self'/,
    );
    assert.equal(store.all().length, 0);
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
