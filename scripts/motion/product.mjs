import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const fit = (box) => {
  const scale = Math.min(1392 / box.width, 580 / box.height, 2.1);
  return {
    x: 720 - (box.x + box.width / 2) * scale,
    y: 314 - (box.y + box.height / 2) * scale,
    scale,
  };
};
export async function prepareProduct(page, base, work) {
  const frame = page.frame({ name: "settled-product" });
  assert.ok(frame, "Live product frame is missing");
  await frame
    .getByRole("heading", { name: "Payment settled. Delivery failed." })
    .waitFor();
  await frame.addStyleTag({ url: `${base}/__demo/product.css` });
  await page.evaluate(() => {
    globalThis.document.querySelector("#hero").style.visibility = "hidden";
  });
  const box = (selector) =>
    frame
      .locator(selector)
      .first()
      .evaluate((node) => {
        const { x, y, width, height } = node.getBoundingClientRect();
        return { x, y, width, height };
      });
  const point = async (selector) => {
    const { x, y, width, height } = await box(selector);
    return { x: x + width / 2, y: y + height / 2 };
  };
  const region = async (first, last) => {
    const a = await box(first),
      b = await box(last);
    return {
      x: a.x,
      y: a.y,
      width: Math.max(a.width, b.width),
      height: b.y + b.height - a.y,
    };
  };
  const portal = async () => {
    await page.locator("#product-camera").evaluate((node) => {
      node.style.height = "1400px";
    });
    await frame.evaluate(() => {
      const inspector = globalThis.document.querySelector("#inspector");
      globalThis.__filmParent ??= inspector.parentElement;
      globalThis.document.body.append(inspector);
      globalThis.document.body.dataset.film = "inspector";
    });
  };
  const cameras = { overview: { x: 0, y: 0, scale: 0.9 } };
  const points = { new: await point("#new-simulation") };
  // Measure live UI bounds before building the camera timeline.
  await frame.locator("#new-simulation").evaluate((node) => node.click());
  cameras.modal = fit(await box("#simulation-dialog"));
  await page.evaluate((camera) => {
    const node = globalThis.document.querySelector("#product-camera");
    node.style.transform = `translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;
  }, cameras.modal);
  points.scenario = await point("#scenario");
  points.run = await point("#simulation-form button[type=submit]");
  await frame.getByLabel("Scenario", { exact: true }).click();
  points.option = await point('option[value="delivery_failed"]');
  await frame
    .getByRole("option", { name: "Paid, delivery failed", exact: true })
    .click();
  await frame.locator("#simulation-dialog").evaluate((node) => node.close());
  await page.evaluate(() => {
    globalThis.document.querySelector("#product-camera").style.transform =
      "scale(.9)";
  });
  await portal();
  cameras.timeline = fit(await region(".tabs", ".evidence-label"));
  cameras.focus = fit(
    await region(".timeline li:nth-child(3)", ".evidence-label"),
  );
  points.transaction = await point("#tab-1");
  points.json = await point("#tab-2");
  await frame.locator("#tab-1").evaluate((node) => node.click());
  cameras.transaction = fit(await region(".tabs", ".evidence-label"));
  const fields = await frame.locator(".transaction-grid dt").allTextContents();
  for (const label of [
    "Evidence source",
    "Network (CAIP-2)",
    "Amount (base units)",
    "Asset / mint",
    "Recipient",
    "Transaction signature",
    "Chain observation",
  ])
    assert.ok(fields.includes(label), `Missing transaction field: ${label}`);
  await frame.locator("#tab-2").evaluate((node) => node.click());
  cameras.json = fit(await region(".tabs", "#trace-panel"));
  points.export = await point(".json-tools a");
  await frame.evaluate(() => {
    const node = globalThis.document.createElement("div");
    node.id = "film-cursor";
    node.innerHTML =
      '<svg viewBox="0 0 24 30" aria-hidden="true"><path d="M2 2L20 17L12 18L8 26L2 2Z" fill="#f3f1ff" stroke="#101218" stroke-width="2"/></svg>';
    globalThis.document.body.append(node);
  });
  let trace;
  let exported;
  let lastTime = -1;
  let nextAction = 0;
  async function reset() {
    await page.locator("#product-camera").evaluate((node) => {
      node.style.height = "700px";
    });
    await frame.evaluate(() => {
      const dialog = globalThis.document.querySelector("#simulation-dialog");
      const cursor = globalThis.document.querySelector("#film-cursor");
      globalThis.document.body.append(cursor);
      dialog.close();
      globalThis.document.querySelector("#tab-0").click();
      const inspector = globalThis.document.querySelector("#inspector");
      globalThis.__filmParent.append(inspector);
      delete globalThis.document.body.dataset.film;
    });
    trace = undefined;
    exported = undefined;
    nextAction = 0;
    lastTime = -1;
  }
  await reset();
  await page.evaluate((metrics) => globalThis.window.setupMotion(metrics), {
    cameras,
    points,
  });
  const actions = [
    {
      at: 4,
      run: async () => {
        await frame
          .getByRole("button", { name: "New simulation", exact: true })
          .click();
        await frame.evaluate(() =>
          globalThis.document
            .querySelector("#simulation-dialog")
            .append(globalThis.document.querySelector("#film-cursor")),
        );
      },
    },
    {
      at: 4.9,
      run: () => frame.getByLabel("Scenario", { exact: true }).click(),
    },
    {
      at: 5.55,
      run: () =>
        frame
          .getByRole("option", { name: "Paid, delivery failed", exact: true })
          .click(),
    },
    {
      at: 6.9,
      run: async () => {
        const response = page.waitForResponse(
          (res) =>
            res.url().endsWith("/api/simulations") &&
            res.request().method() === "POST",
        );
        await frame
          .getByRole("button", { name: "Run simulation", exact: true })
          .click();
        trace = await (await response).json();
        assert.equal(trace.events[3].status, "success");
        assert.equal(trace.events[4].status, "failure");
        await frame.locator("dialog[open]").waitFor({ state: "hidden" });
        await frame.evaluate(() =>
          globalThis.document.body.append(
            globalThis.document.querySelector("#film-cursor"),
          ),
        );
        await frame
          .locator(".trace-id")
          .filter({ hasText: trace.id })
          .waitFor();
        await page.evaluate(
          (trace) => globalThis.window.setEvidence({ version: 1, trace }),
          trace,
        );
      },
    },
    { at: 7.9, run: portal },
    {
      at: 10.9,
      run: () =>
        frame
          .locator("#trace-panel")
          .evaluate((node) => (node.dataset.highlight = "delivery")),
    },
    {
      at: 13.8,
      run: () =>
        frame.getByRole("tab", { name: "Transaction", exact: true }).click(),
    },
    {
      at: 17.65,
      run: () => frame.getByRole("tab", { name: "JSON", exact: true }).click(),
    },
    {
      at: 19.05,
      run: async () => {
        const download = page.waitForEvent("download");
        await frame.locator(".json-tools a").click();
        const path = await (await download).path();
        exported = JSON.parse(await readFile(path, "utf8"));
        assert.equal(exported.trace.id, trace.id);
        assert.equal(exported.trace.outcome, "delivery_failed");
        await writeFile(
          join(work, "export.json"),
          JSON.stringify(exported, null, 2),
        );
        await page.evaluate(
          (data) => globalThis.window.setEvidence(data),
          exported,
        );
      },
    },
  ];
  async function seek(time) {
    if (time < lastTime) await reset();
    while (nextAction < actions.length && actions[nextAction].at <= time) {
      const action = actions[nextAction++];
      await page.evaluate(
        (t) => globalThis.window.renderAt(t - 0.001),
        action.at,
      );
      await action.run();
    }
    await page.evaluate((t) => globalThis.window.renderAt(t), time);
    lastTime = time;
  }
  async function checkFraming(time) {
    const selectors =
      time < 7
        ? ["#simulation-dialog"]
        : time < 13.8
          ? [
              ".timeline li:nth-child(3)",
              ".timeline li:last-child",
              ".diagnostic",
              ".evidence-label",
            ]
          : time < 17.65
            ? [".tabs", ".transaction-grid", ".diagnostic", ".evidence-label"]
            : [".tabs", ".json-tools", "#trace-panel pre"];
    const screen = await page.locator("#product-viewport").boundingBox();
    assert.ok(screen, "Missing live viewport");
    for (const selector of selectors) {
      const bounds = await box(selector);
      const viewport = await frame.evaluate(() => ({
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
      }));
      assert.ok(
        bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= viewport.width + 1 &&
          bounds.y + bounds.height <= viewport.height + 1,
        `UI exceeds iframe viewport: ${selector}`,
      );
      const actual = await frame.locator(selector).first().boundingBox();
      assert.ok(
        actual &&
          actual.x >= screen.x - 2 &&
          actual.y >= screen.y - 2 &&
          actual.x + actual.width <= screen.x + screen.width + 2 &&
          actual.y + actual.height <= screen.y + screen.height + 2,
        `Clipped live UI at ${time}s: ${selector}`,
      );
    }
  }
  return {
    seek,
    checkFraming,
    metrics: { cameras, points },
    getEvidence: () => exported,
  };
}
