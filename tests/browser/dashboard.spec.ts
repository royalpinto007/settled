import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("dropdowns support pointer and keyboard selection", async ({ page }) => {
  await page.goto("/");
  const outcome = page.getByLabel("Filter by outcome");
  await outcome.click();
  await expect(
    page.getByRole("option", { name: "Delivered", exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Delivered", exact: true }).click();
  await expect(outcome).toHaveValue("delivered");
  await expect(page.locator(".request-row").first()).toContainText("Delivered");
  const source = page.getByLabel("Filter by source");
  await source.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(source).toHaveValue("simulation");
  await outcome.click();
  await page.keyboard.press("Escape");
  await expect(outcome).toBeFocused();
});

test("architecture diagrams are available inside the app", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Architecture", exact: true }).click();
  await expect(page).toHaveURL("/architecture.html");
  await expect(
    page.getByRole("heading", { name: "Architecture", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Settled? system architecture",
    "Payment request lifecycle",
  ]) {
    const diagram = page.getByRole("img", { name, exact: true });
    await expect(diagram).toBeVisible();
    expect(
      await diagram.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    ).toBeGreaterThan(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Integration guide", exact: true })
    .click();
  await expect(page).toHaveURL("/guide.html");
});

test("inspect a paid delivery failure, switch views with the keyboard, and export evidence", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Payment settled. Delivery failed." }),
  ).toBeVisible();
  await expect(page.locator(".timeline li")).toHaveCount(5);
  if (info.project.name === "desktop")
    await page.screenshot({
      path: info.outputPath("dashboard.png"),
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Timeline", exact: true }).focus();
  await page
    .getByRole("tab", { name: "Timeline", exact: true })
    .press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Transaction", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".transaction-grid")).toContainText("sim_");
  await expect(
    page.getByRole("link", { name: /Open in Solana Explorer/ }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  const json = JSON.parse(await page.getByLabel("Trace JSON").innerText());
  expect(json.source).toBe("simulation");
  expect(json.outcome).toBe("delivery_failed");
  const downloaded = page.waitForEvent("download");
  await page.getByLabel("Export selected trace").first().click();
  const download = await downloaded;
  const path = await download.path();
  expect(JSON.parse(await readFile(path!, "utf8")).trace.id).toBe(json.id);
  expect(errors).toEqual([]);
});

test("simulate a timeout, filter requests, and recover from an empty search", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New simulation" }).click();
  await page.getByLabel("Scenario", { exact: true }).selectOption("timeout");
  const path = `/api/browser-${info.project.name}`;
  await page.getByLabel("Resource path").fill(path);
  await page.getByLabel("Amount in base units").fill("0");
  await page
    .getByRole("button", { name: "Run simulation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Settlement outcome is unknown." }),
  ).toBeVisible();
  await page.getByLabel("Search requests").fill(path);
  await expect(page.locator(".request-row")).toHaveCount(1);
  await page.getByLabel("Filter by outcome").selectOption("delivered");
  await expect(
    page.getByRole("heading", { name: "No requests found" }),
  ).toBeVisible();
  await page.getByLabel("Filter by outcome").selectOption("all");
  await expect(page.locator(".request-row")).toHaveCount(1);
  await page.getByLabel("Search requests").fill("");
  await expect(page.locator(".request-row")).not.toHaveCount(1);
});

test("captured metadata is displayed as text and invalid Devnet signatures stay local", async ({
  page,
  request,
}, info) => {
  const simulated = await request.post("/api/simulations", {
    data: { scenario: "success" },
  });
  const { request: req, payment, events } = await simulated.json();
  const malicious = '<img src=x onerror="document.body.dataset.injected=1">';
  events[0].detail = malicious;
  req.path = `/api/captured-${info.project.name}`;
  const captured = await request.post("/api/traces", {
    data: { request: req, payment, events },
  });
  expect(captured.status()).toBe(201);
  await page.goto("/");
  await page
    .getByRole("button", {
      name: `GET ${req.path}, Delivered, Captured`,
      exact: true,
    })
    .click();
  await expect(page.getByText(malicious, { exact: true })).toBeVisible();
  expect(await page.locator("body").getAttribute("data-injected")).toBeNull();
  await page
    .getByRole("button", { name: "Devnet inspector", exact: true })
    .click();
  await page
    .getByLabel("Transaction signature", { exact: true })
    .fill("0".repeat(64));
  await page.getByRole("button", { name: "Check Devnet", exact: true }).click();
  await expect(page.locator("#devnet-error")).toContainText("signature");
  await page.getByLabel("Close Devnet inspector").click();
  await page
    .getByRole("link", { name: "Integration guide", exact: true })
    .click();
  await expect(page).toHaveURL("/guide.html");
  await expect(
    page.getByRole("heading", { name: "Local API", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table").first()).toContainText("/api/traces");
  await page.getByRole("link", { name: "Capture", exact: true }).click();
  await expect(page).toHaveURL("/guide.html#capture");
  await expect(page.locator("#capture + pre")).toContainText('"events"');
  await page.reload();
  await expect(page.locator("#capture")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Back to requests", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Did the payment settle?" }),
  ).toBeVisible();
});
