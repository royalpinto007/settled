import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { output: { type: "string" } } });
const temporary = await mkdtemp(join(tmpdir(), "settled-package-"));
let server;
let logs = "";
function npm(...args) {
  const result = spawnSync("npm", args, {
    cwd: temporary,
    encoding: "utf8",
    timeout: 120_000,
  });
  assert.equal(
    result.status,
    0,
    result.stderr || result.error?.message || result.stdout,
  );
  return result.stdout;
}
async function stop() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGTERM");
  try {
    await Promise.race([
      exited,
      setTimeout(5000, undefined, { ref: false }).then(() => {
        throw new Error("CLI did not stop cleanly");
      }),
    ]);
  } finally {
    if (server.exitCode === null && server.signalCode === null)
      server.kill("SIGKILL");
  }
}
try {
  const packed = JSON.parse(
    npm("pack", process.cwd(), "--ignore-scripts", "--json"),
  )[0];
  const files = packed.files.map((file) => file.path);
  for (const required of [
    "dist/cli.js",
    "dist/server.js",
    "dist/public/index.html",
    "dist/public/app.js",
    "dist/public/guide.html",
    "dist/public/architecture.html",
    "dist/public/setup.html",
    "README.md",
    "LICENSE",
  ])
    assert.ok(files.includes(required), `Missing package file: ${required}`);
  for (const file of files) {
    assert.match(
      file,
      /^(dist\/|docs\/|examples\/|package\.json$|README\.md$|LICENSE$|CONTRIBUTING\.md$|CHANGELOG\.md$)/,
    );
    assert.doesNotMatch(
      file,
      /(^|\/)(\.env[^/]*|\.npmrc|data|tests|node_modules)(\/|$)|\.(pem|key|mp4|webm|tgz)$/i,
    );
  }
  const tarball = join(temporary, packed.filename);
  await writeFile(join(temporary, "package.json"), '{"private":true}');
  npm(
    "install",
    "--omit=dev",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball,
  );
  const cli = join(temporary, "node_modules", ".bin", "settled");
  for (const flag of ["--help", "--version"]) {
    const result = spawnSync(cli, [flag], {
      cwd: temporary,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.ok(result.stdout.trim());
  }
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((done, reject) =>
    socket.close((error) => (error ? reject(error) : done())),
  );
  const directory = join(temporary, "traces");
  server = spawn(
    cli,
    ["--demo", "--port", String(port), "--data-dir", directory],
    { cwd: temporary, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  server.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  server.on("error", (error) => {
    logs += error.message;
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      assert.equal((await response.json()).count, 6);
      ready = true;
      break;
    } catch {
      if (server.exitCode !== null) break;
      await setTimeout(100);
    }
  }
  assert.ok(ready, `Installed CLI failed to start: ${logs}`);
  for (const path of [
    "/",
    "/guide.html",
    "/architecture.html",
    "/setup.html",
    "/app.js",
    "/architecture.svg",
  ]) {
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 100, path);
  }
  const response = await fetch(`${base}/api/simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenario: "delivery_failed",
      path: "/api/package-check",
    }),
    signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 201);
  const trace = await response.json();
  assert.equal(trace.outcome, "delivery_failed");
  assert.equal(trace.events[3].status, "success");
  assert.equal(trace.events[4].status, "failure");
  const exported = await fetch(`${base}/api/traces/${trace.id}/export`, {
    signal: AbortSignal.timeout(2000),
  });
  assert.equal((await exported.json()).trace.id, trace.id);
  await stop();
  assert.equal(server.exitCode, 0, logs);
  const stored = JSON.parse(
    await readFile(join(directory, "traces.json"), "utf8"),
  );
  assert.equal(stored.traces.length, 7);
  assert.ok(stored.traces.some((item) => item.id === trace.id));
  await assert.rejects(readFile(join(directory, ".lock")), { code: "ENOENT" });
  if (values.output) await copyFile(tarball, resolve(values.output));
  console.log(
    `Verified ${packed.filename}: ${files.length} files, ${(packed.size / 1024).toFixed(0)} KB. Installed CLI, offline pages, simulation, JSON export and local persistence passed. Nothing published.`,
  );
} finally {
  await stop();
  await rm(temporary, { recursive: true, force: true });
}
