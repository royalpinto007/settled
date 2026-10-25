import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const outputArgument = process.argv.indexOf("--output");
const output = resolve(
  outputArgument >= 0
    ? process.argv[outputArgument + 1]
    : join(homedir(), "Downloads", "settled-demo.mp4"),
);
if (!process.argv.includes("--replace")) {
  try {
    await access(output);
    throw new Error("Demo exists. Use --replace to regenerate it.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await mkdir(dirname(output), { recursive: true });
const work = await mkdtemp(join(tmpdir(), "settled-video-"));
const server = spawn(process.execPath, ["dist/server.js", "--demo"], {
  env: { ...process.env, PORT: "4415", DATA_DIR: join(work, "data") },
  stdio: ["ignore", "ignore", "pipe"],
});
const base = "http://127.0.0.1:4415";
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* The loopback server may still be starting. */
    }
    if (server.exitCode !== null)
      throw new Error("Demo server exited before capture.");
    await delay(100);
  }
  if (!ready) throw new Error("Demo server did not start.");
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    timezoneId: "Asia/Kolkata",
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Payment settled. Delivery failed." })
    .waitFor();
  await page.screencast.showActions({
    cursor: "pointer",
    duration: 450,
    style: {
      title: "display: none",
      point:
        "width: 18px; height: 18px; border: 2px solid #b7a3ff; border-radius: 50%",
    },
  });
  const shots = [];
  function between(first, last) {
    return async () => {
      const top = await first.boundingBox();
      const bottom = await last.boundingBox();
      if (!top || !bottom) throw new Error("Missing framing anchors.");
      return {
        x: top.x,
        y: top.y,
        width: Math.max(top.width, bottom.width),
        height: bottom.y + bottom.height - top.y,
      };
    };
  }
  async function pointAt(locator) {
    const box = await locator.boundingBox();
    if (box)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 18,
      });
  }
  async function record(name, minimum, action, region) {
    const path = join(work, `${name}.webm`);
    await page.screencast.start({
      path,
      size: { width: 1600, height: 1000 },
      fps: 30,
      quality: 95,
    });
    const started = performance.now();
    await action();
    const box =
      typeof region === "function"
        ? await region()
        : await region.boundingBox();
    if (!box) throw new Error(`Missing visible region for ${name}`);
    const crop = {
      x: Math.max(0, Math.floor(box.x - 12)),
      y: Math.max(0, Math.floor(box.y - 12)),
      width: Math.min(1580, Math.ceil(box.width + 24)),
      height: Math.min(940, Math.ceil(box.height + 24)),
    };
    crop.width = Math.min(crop.width, 1600 - crop.x);
    crop.height = Math.min(crop.height, 1000 - crop.y);
    await delay(
      Math.max(0, minimum * 1000 + 350 - (performance.now() - started)),
    );
    await page.screencast.stop();
    shots.push({ name, path, crop });
    console.log(`Captured ${name}`);
  }
  await page.mouse.wheel(0, 390);
  await delay(450);
  await record(
    "hook",
    3.3,
    async () => {
      await pointAt(page.locator(".timeline li").nth(3));
      await delay(550);
      await pointAt(page.locator(".timeline li").nth(4));
      await delay(600);
      await pointAt(page.locator(".diagnostic"));
    },
    between(page.locator(".timeline li").nth(2), page.locator(".diagnostic")),
  );
  await page.goto(base);
  await page.getByRole("button", { name: "New simulation" }).waitFor();
  let created;
  let formBox;
  await record(
    "simulate",
    5.1,
    async () => {
      await pointAt(page.getByRole("button", { name: "New simulation" }));
      await page.getByRole("button", { name: "New simulation" }).click();
      await delay(550);
      await page.getByLabel("Scenario", { exact: true }).click();
      await delay(650);
      await page
        .getByRole("option", { name: "Paid, delivery failed", exact: true })
        .click();
      await delay(750);
      formBox = await page.getByRole("dialog").boundingBox();
      await pointAt(
        page.getByRole("button", { name: "Run simulation", exact: true }),
      );
      await delay(1500);
      const response = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/simulations") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Run simulation", exact: true })
        .click();
      created = await (await response).json();
    },
    () => formBox,
  );
  if (
    created.events[3].status !== "success" ||
    created.events[4].status !== "failure"
  )
    throw new Error("Real simulation did not produce the expected lifecycle.");
  await page.mouse.wheel(0, 390);
  await delay(450);
  await record(
    "timeline",
    5.4,
    async () => {
      await pointAt(page.locator(".timeline li").nth(2));
      await delay(750);
      await pointAt(page.locator(".timeline li").nth(3));
      await delay(900);
      await pointAt(page.locator(".timeline li").nth(4));
      await delay(800);
      await pointAt(page.locator(".diagnostic"));
    },
    between(page.locator(".timeline li").nth(2), page.locator(".diagnostic")),
  );
  await record(
    "transaction",
    3.5,
    async () => {
      await page.getByRole("tab", { name: "Transaction", exact: true }).click();
      await delay(600);
      await pointAt(
        page
          .locator(".transaction-grid")
          .getByText("sim_" + created.transaction.signature.slice(4), {
            exact: true,
          }),
      );
    },
    between(
      page.locator(".transaction-grid > div").nth(4),
      page.locator(".diagnostic"),
    ),
  );
  let exported;
  await record(
    "export",
    5.2,
    async () => {
      await page.getByRole("tab", { name: "JSON", exact: true }).click();
      await delay(800);
      const downloaded = page.waitForEvent("download");
      await page.getByLabel("Export selected trace").first().click();
      const download = await downloaded;
      exported = JSON.parse(await readFile(await download.path(), "utf8"));
      await delay(650);
      await page.getByLabel("Trace JSON").hover();
      await page.mouse.wheel(0, 190);
      await delay(900);
    },
    between(page.locator(".json-tools"), page.getByLabel("Trace JSON")),
  );
  if (exported.trace.id !== created.id)
    throw new Error("Export does not match the recorded request.");
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    join(work, "shots.json"),
    JSON.stringify(
      {
        shots,
        source: "Real browser capture of offline demo scenarios",
        traceId: created.id,
      },
      null,
      2,
    ),
  );
  await context.close();
  await browser.close();
  browser = undefined;
  const render = spawn("python3", ["scripts/render-demo.py", work, output], {
    stdio: "inherit",
  });
  const [code] = await once(render, "exit");
  if (code !== 0) throw new Error(`Video renderer exited with ${code}`);
  console.log(`Saved ${output}`);
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill("SIGTERM");
    await stopped;
  }
  await rm(work, { recursive: true, force: true });
}
