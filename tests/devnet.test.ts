import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { checkDevnet } from "../src/adapters/devnet.js";

test("Devnet adapter opts into version 1 and handles confirmed, failed, absent and incomplete transactions over HTTP", async () => {
  const signature = "1".repeat(64);
  let result: unknown = {
    version: 1,
    slot: 123,
    blockTime: 1750000000,
    meta: { err: null, fee: 5000 },
    transaction: { signatures: [signature] },
  };
  let received: Record<string, unknown> = {};
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.setHeader("Content-Type", "application/json");
    const params = received.params as [
      string,
      { maxSupportedTransactionVersion: number },
    ];
    res.end(
      JSON.stringify(
        params[1].maxSupportedTransactionVersion < 1
          ? {
              jsonrpc: "2.0",
              id: 1,
              error: {
                code: -32015,
                message: "Transaction version (1) is not supported",
              },
            }
          : { jsonrpc: "2.0", id: 1, result },
      ),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as { port: number }).port;
  const transport: typeof fetch = (_url, init) =>
    fetch(`http://127.0.0.1:${port}`, init);
  try {
    const confirmed = await checkDevnet(signature, transport);
    assert.equal(confirmed.state, "confirmed");
    assert.equal(confirmed.feeLamports, 5000);
    assert.equal(received.method, "getTransaction");
    assert.deepEqual(received.params, [
      signature,
      {
        commitment: "confirmed",
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 1,
      },
    ]);
    result = {
      slot: 123,
      blockTime: null,
      meta: { err: { InstructionError: [0, "InvalidArgument"] }, fee: 5000 },
      transaction: { signatures: [signature] },
    };
    assert.equal((await checkDevnet(signature, transport)).state, "failed");
    result = null;
    assert.equal((await checkDevnet(signature, transport)).state, "not_found");
    result = {
      slot: 123,
      blockTime: null,
      meta: null,
      transaction: { signatures: [signature] },
    };
    assert.equal((await checkDevnet(signature, transport)).state, "unknown");
    result = { wrong: true };
    await assert.rejects(checkDevnet(signature, transport), /malformed/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Devnet rejects invalid signatures, RPC errors and network outages without confirming", async () => {
  await assert.rejects(checkDevnet("invalid"), /signature/i);
  await assert.rejects(
    checkDevnet(
      "1".repeat(64),
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "unavailable" },
          }),
        ),
    ),
    /RPC/i,
  );
  await assert.rejects(
    checkDevnet("1".repeat(64), async () => {
      throw new Error("offline");
    }),
    /unavailable/i,
  );
});
