import express from "express";
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { inspect: { type: "boolean" } },
});
if (positionals.length !== 2)
  throw new Error(
    "Usage: node scripts/render-demo.mjs CAPTURE_DIRECTORY OUTPUT.mp4 [--inspect]",
  );
const [work, output] = positionals.map((path) => resolve(path));
assert.match(output, /\.mp4$/i, "Output path must end in .mp4");
const root = fileURLToPath(new URL("motion/", import.meta.url));
const fps = 60;
const duration = 28;
async function run(command, args) {
  const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
  let error = "";
  child.stderr.on("data", (chunk) => {
    error += chunk;
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, error);
}
await mkdir(dirname(output), { recursive: true });
const manifest = JSON.parse(await readFile(join(work, "shots.json"), "utf8"));
// Short GOPs make deterministic video seeking cheap. Crops contain only real UI.
for (const shot of manifest.shots) {
  if (shot.name === "hook") continue;
  const { x, y, width, height } = shot.crop;
  await run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    shot.path,
    "-vf",
    `crop=${width}:${height}:${x}:${y},scale=1200:800:force_original_aspect_ratio=decrease:force_divisible_by=2`,
    "-an",
    "-c:v",
    "libx264",
    "-threads",
    "2",
    "-preset",
    "fast",
    "-crf",
    "16",
    "-g",
    "15",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    join(work, `${shot.name}.mp4`),
  ]);
}
await build({
  entryPoints: [join(root, "timeline.ts")],
  bundle: true,
  format: "iife",
  outfile: join(work, "motion.js"),
  target: "es2022",
});
const app = express();
app.get("/motion.js", (_req, res) => res.sendFile(join(work, "motion.js")));
app.get("/font-heavy.ttf", (_req, res) =>
  res.sendFile("/usr/share/fonts/truetype/lato/Lato-Heavy.ttf"),
);
app.get("/font-regular.ttf", (_req, res) =>
  res.sendFile("/usr/share/fonts/truetype/lato/Lato-Regular.ttf"),
);
app.use("/assets", express.static(work, { dotfiles: "deny" }));
app.use(express.static(root));
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
let browser;
let encoder;
try {
  browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(
    () => typeof globalThis.window.renderAt === "function",
  );
  const seek = (time) =>
    page.evaluate((t) => globalThis.window.renderAt(t), time);
  // Check seekability before export: scrubbing backwards must preserve the edit.
  const state = () =>
    page.evaluate(() =>
      ["#flow", "#trace-film", "#inspect"].map((selector) => {
        const css = globalThis.getComputedStyle(
          globalThis.document.querySelector(selector),
        );
        return [css.transform, css.opacity, css.visibility];
      }),
    );
  await seek(10);
  const expected = await state();
  await seek(21);
  await seek(10);
  assert.deepEqual(
    await state(),
    expected,
    "GSAP composition must be deterministic when scrubbed",
  );
  await seek(0);
  const timestamps = [
    0.7, 1.9, 3.55, 5.6, 7.65, 9.8, 11.9, 14.9, 16.4, 18.8, 20.8, 23.9, 25.8,
  ];
  for (const [index, time] of timestamps.entries()) {
    await seek(time);
    await page.screenshot({
      path: join(work, `inspect-${String(index).padStart(2, "0")}.jpg`),
      type: "jpeg",
      quality: 90,
    });
  }
  await run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-framerate",
    "1",
    "-i",
    join(work, "inspect-%02d.jpg"),
    "-vf",
    "scale=640:360,tile=3x5:padding=8:margin=8:color=0x22242e",
    "-frames:v",
    "1",
    join(work, "motion-contact.jpg"),
  ]);
  assert.deepEqual(errors, []);
  console.log(
    `GSAP scrub checks passed. Contact sheet: ${join(work, "motion-contact.jpg")}`,
  );
  if (!values.inspect) {
    await seek(0);
    const silent = join(work, "motion-silent.mp4");
    encoder = spawn(
      "ffmpeg",
      [
        "-v",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-c:v",
        "mjpeg",
        "-framerate",
        String(fps),
        "-i",
        "pipe:0",
        "-an",
        "-c:v",
        "libx264",
        "-threads",
        "2",
        "-preset",
        "fast",
        "-crf",
        "17",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        silent,
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let encoderErrors = "";
    encoder.stderr.on("data", (chunk) => {
      encoderErrors += chunk;
    });
    encoder.stdin.on("error", (error) => errors.push(error.message));
    const encoded = once(encoder, "exit");
    const started = performance.now();
    for (let frame = 0; frame < fps * duration; frame++) {
      await seek(frame / fps);
      const jpeg = await page.screenshot({ type: "jpeg", quality: 94 });
      if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, "drain");
      if (frame % (fps * 2) === 0)
        console.log(
          `Rendered ${(frame / fps).toFixed(0)}/${duration}s (${((performance.now() - started) / 1000).toFixed(0)}s elapsed)`,
        );
    }
    encoder.stdin.end();
    const [code] = await encoded;
    assert.equal(code, 0, encoderErrors);
    assert.deepEqual(errors, []);
    await run("python3", ["scripts/render-demo.py", work, output]);
    await seek(11.9);
    await page.screenshot({ path: output.replace(/\.mp4$/i, ".png") });
    console.log(`Saved GSAP motion edit: ${output}`);
  }
  await writeFile(
    join(work, "motion-check.json"),
    JSON.stringify(
      { duration, fps, scrubCheck: "passed", errors, timestamps },
      null,
      2,
    ),
  );
} finally {
  if (encoder?.exitCode === null) encoder.kill("SIGTERM");
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
}
