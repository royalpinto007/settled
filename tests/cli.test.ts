import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function cli(...args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", ...args],
    { encoding: "utf8", timeout: 10000 },
  );
}

test("CLI help and version exit without starting a server", () => {
  const help = cli("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /settled.*--demo/);
  assert.match(help.stdout, /--data-dir/);
  const version = cli("--version");
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^0\.1\.0\s*$/);
});

test("CLI rejects invalid ports and unsupported arguments with a useful message", () => {
  for (const port of ["0", "80", "65536", "abc"]) {
    const result = cli("--port", port);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /port.*1024.*65535/i);
    assert.doesNotMatch(result.stderr, /at file:/);
  }
  const unknown = cli("--unknown");
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown/i);
});
