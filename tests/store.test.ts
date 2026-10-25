import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../src/adapters/store.js";
import { simulate } from "../src/domain/trace.js";

test("concurrent writes survive reopening and a second process is refused", async () => {
  const dir = await mkdtemp(join(tmpdir(), "settled-test-"));
  const store = new JsonStore(dir);
  try {
    await store.open();
    await assert.rejects(new JsonStore(dir).open(), /locked/i);
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.add(simulate({ scenario: "success" })),
      ),
    );
    assert.equal(store.all().length, 20);
    const copy = store.all();
    copy.length = 0;
    assert.equal(store.all().length, 20);
    await store.close();
    await store.open();
    assert.equal(store.all().length, 20);
    assert.equal(
      JSON.parse(await readFile(join(dir, "traces.json"), "utf8")).version,
      1,
    );
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("corrupt storage fails closed without replacing user data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "settled-test-"));
  const path = join(dir, "traces.json");
  await writeFile(path, "{broken");
  const store = new JsonStore(dir);
  try {
    await assert.rejects(store.open(), /corrupt/i);
    assert.equal(await readFile(path, "utf8"), "{broken");
  } finally {
    await store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
