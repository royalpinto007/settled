import type { Trace } from "../domain/trace.js";

type Diagnostic = {
  tone: "good" | "bad" | "warn";
  title: string;
  advice: string;
};
type Entry = Trace & { diagnostic: Diagnostic };
type Page = {
  items: Entry[];
  total: number;
  nextOffset: number | null;
  stats: {
    total: number;
    delivered: number;
    issues: number;
    settledUndelivered: number;
  };
};
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
}
function icon(name: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `/icons.svg#${name}`);
  svg.setAttribute("aria-hidden", "true");
  svg.append(use);
  return svg;
}
const outcomes: Record<Trace["outcome"], { label: string; tone: string }> = {
  delivered: { label: "Delivered", tone: "good" },
  delivery_failed: { label: "Delivery failed", tone: "bad" },
  payment_failed: { label: "Payment failed", tone: "bad" },
  timeout: { label: "Timed out", tone: "warn" },
  error: { label: "Server error", tone: "bad" },
  observed: { label: "Observed", tone: "neutral" },
};
const sourceLabel = {
  simulation: "Simulation",
  capture: "Captured",
  devnet: "Devnet",
};
const stageLabels = {
  request: "API request",
  challenge: "Payment required",
  verification: "Payment verification",
  settlement: "Settlement",
  delivery: "Resource delivery",
};
const duration = (trace: Trace) =>
  trace.events.length
    ? `${Math.max(...trace.events.map((e) => e.atMs + e.durationMs)).toLocaleString()} ms`
    : "n/a";
const badge = (trace: Trace) =>
  el(
    "span",
    `badge ${outcomes[trace.outcome].tone}`,
    outcomes[trace.outcome].label,
  );
const source = (trace: Trace) =>
  el("span", "source-tag", sourceLabel[trace.source]);
const time = (trace: Trace) =>
  new Date(trace.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
let entries: Entry[] = [];
let selectedId = "";
let total = 0;
let nextOffset: number | null = null;
let revision = 0;
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 3500);
}
async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json();
  if (!response.ok) {
    const details = data.error?.details
      ?.map(
        (detail: { path: string[]; message: string }) =>
          `${detail.path.join(".")}: ${detail.message}`,
      )
      .join(" ");
    throw new Error(
      details || data.error?.message || "Request failed. Try again.",
    );
  }
  return data as T;
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard");
  } catch {
    toast("Clipboard unavailable. Select and copy the text manually.");
  }
}
function downloadLink(trace: Trace) {
  const link = el("a", "text-button", icon("download"), "Export");
  link.href = `/api/traces/${trace.id}/export`;
  link.download = "";
  link.setAttribute("aria-label", "Export selected trace");
  return link;
}
function selectTrace(id: string, scroll = false) {
  selectedId = id;
  for (const node of document.querySelectorAll<HTMLButtonElement>(
    ".request-row",
  )) {
    const selected = node.dataset.id === id;
    node.classList.toggle("selected", selected);
    node.setAttribute("aria-pressed", String(selected));
  }
  const trace = entries.find((entry) => entry.id === id);
  if (trace) renderInspector(trace);
  if (scroll && window.innerWidth <= 760)
    $("inspector").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
}
function renderList() {
  const focusedId = (
    document.activeElement as HTMLElement
  )?.closest<HTMLButtonElement>(".request-row")?.dataset.id;
  const rows = entries.map((trace) => {
    const title = el(
      "div",
      "request-title",
      el("span", "method", trace.request.method),
      el("span", "request-path", trace.request.path),
    );
    const meta = el(
      "div",
      "request-meta",
      el("span", "request-id", trace.id.slice(0, 8)),
      el("span", "", time(trace)),
      source(trace),
    );
    const row = el(
      "button",
      `request-row${trace.id === selectedId ? " selected" : ""}`,
      el("div", "", title, meta),
      badge(trace),
      el("span", "duration", duration(trace)),
    );
    row.type = "button";
    row.dataset.id = trace.id;
    row.setAttribute(
      "aria-label",
      `${trace.request.method} ${trace.request.path}, ${outcomes[trace.outcome].label}, ${sourceLabel[trace.source]}`,
    );
    row.setAttribute("aria-pressed", String(trace.id === selectedId));
    row.addEventListener("click", () => selectTrace(trace.id, true));
    return row;
  });
  $("request-rows").replaceChildren(...rows);
  if (focusedId)
    rows
      .find((node) => node.dataset.id === focusedId)
      ?.focus({ preventScroll: true });
  $("empty-state").hidden = total > 0;
  $("result-count").textContent = String(total);
  $("list-summary").textContent =
    `Showing ${entries.length} of ${total} requests`;
  $("load-more").hidden = nextOffset === null;
}
function diagnostic(trace: Entry) {
  const { tone, title, advice } = trace.diagnostic;
  return el(
    "aside",
    `diagnostic ${tone}`,
    el("h3", "", title),
    el("p", "", advice),
  );
}
function renderTimeline(trace: Entry): HTMLElement {
  const body = el("div");
  if (!trace.events.length) {
    body.append(
      el(
        "div",
        "empty",
        icon("network"),
        el("h3", "", "Chain observation only"),
        el(
          "p",
          "",
          "No API lifecycle was captured for this transaction. Open Transaction for the RPC result.",
        ),
      ),
      diagnostic(trace),
    );
    return body;
  }
  body.append(
    el(
      "div",
      "trace-overview",
      el("strong", "", "Request lifecycle"),
      el(
        "span",
        "",
        `${duration(trace)}${trace.source === "simulation" ? " · simulated time" : ""}`,
      ),
    ),
  );
  const strip = el("div", "stage-strip");
  strip.setAttribute("aria-hidden", "true");
  for (const event of trace.events) strip.append(el("span", event.status));
  body.append(strip);
  const list = el("ol", "timeline");
  for (const event of trace.events) {
    const status = { success: "✓", failure: "×", timeout: "!", skipped: "−" }[
      event.status
    ];
    const title = el(
      "div",
      "event-title",
      el("span", "", stageLabels[event.stage]),
    );
    if (event.httpStatus)
      title.append(
        el(
          "span",
          `badge ${event.httpStatus >= 500 ? "bad" : event.httpStatus === 402 ? "neutral" : "good"}`,
          String(event.httpStatus),
        ),
      );
    title.append(
      el(
        "small",
        "",
        event.status === "skipped"
          ? "Skipped"
          : `${event.durationMs.toLocaleString()} ms`,
      ),
    );
    const node = el("span", `event-node ${event.status}`, status);
    node.setAttribute("aria-label", event.status);
    list.append(
      el(
        "li",
        "",
        node,
        el(
          "div",
          event.status === "skipped" ? "skipped-content" : "",
          title,
          el("p", "event-detail", event.detail),
        ),
      ),
    );
  }
  body.append(
    list,
    diagnostic(trace),
    el(
      "p",
      "evidence-label",
      trace.source === "simulation"
        ? "Sandbox evidence only. Timings, verification and settlement are simulated. No funds were moved."
        : "Captured evidence is reported by your application. Settled? does not independently verify payment payloads.",
    ),
  );
  return body;
}
function renderTransaction(trace: Entry): HTMLElement {
  const body = el("div");
  const grid = el("dl", "transaction-grid");
  function field(label: string, value: string | Node) {
    grid.append(el("div", "", el("dt", "", label), el("dd", "", value)));
  }
  field("Evidence source", sourceLabel[trace.source]);
  if (trace.payment) {
    field("Network (CAIP-2)", trace.payment.network);
    field("Amount (base units)", trace.payment.amount);
    field("Asset / mint", trace.payment.asset);
    if (trace.payment.recipient) field("Recipient", trace.payment.recipient);
  }
  const tx = trace.transaction;
  if (tx) {
    field("Transaction signature", tx.signature);
    field("Chain observation", tx.state.replaceAll("_", " "));
    if (tx.slot !== undefined) field("Slot", String(tx.slot));
    if (tx.feeLamports !== undefined)
      field("Fee (lamports)", String(tx.feeLamports));
    if (tx.blockTime != null)
      field("Block time", new Date(tx.blockTime * 1000).toISOString());
    if (tx.checkedAt)
      field("Checked at", new Date(tx.checkedAt).toLocaleString());
    if (tx.error) field("Transaction error", tx.error);
    if (trace.source !== "simulation") {
      const explorer = el("a", "", "Open in Solana Explorer ↗");
      explorer.href = `https://explorer.solana.com/tx/${encodeURIComponent(tx.signature)}?cluster=devnet`;
      explorer.target = "_blank";
      explorer.rel = "noreferrer";
      field("Explorer", explorer);
    }
  } else field("Transaction", "No settlement transaction was recorded.");
  body.append(grid, diagnostic(trace));
  if (trace.source === "simulation")
    body.append(
      el(
        "p",
        "evidence-label",
        "Fixture signatures are not Solana transactions and cannot be opened in an explorer.",
      ),
    );
  return body;
}
function renderJson(trace: Entry): HTMLElement {
  const json = JSON.stringify(trace, null, 2);
  const copyButton = el("button", "text-button", icon("copy"), "Copy JSON");
  copyButton.type = "button";
  copyButton.onclick = () => {
    void copy(json);
  };
  const pre = el("pre", "", el("code", "", json));
  pre.tabIndex = 0;
  pre.setAttribute("aria-label", "Trace JSON");
  return el(
    "div",
    "",
    el("div", "json-tools", copyButton, downloadLink(trace)),
    pre,
  );
}
function renderInspector(trace: Entry) {
  const title = el(
    "h2",
    "",
    el("span", "method", trace.request.method),
    trace.request.path,
  );
  const copyId = el("button", "", icon("copy"));
  copyId.type = "button";
  copyId.setAttribute("aria-label", "Copy request ID");
  copyId.onclick = () => {
    void copy(trace.id);
  };
  const identity = el(
    "div",
    "",
    title,
    el("div", "trace-id", trace.id, copyId),
  );
  const heading = el("div", "inspector-heading", identity, downloadLink(trace));
  const info = el(
    "div",
    "inspector-info",
    badge(trace),
    source(trace),
    el(
      "span",
      "",
      new Date(trace.createdAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
    ),
    el("span", "", time(trace)),
  );
  const tabList = el("div", "tabs");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Trace views");
  const panel = el("div");
  panel.id = "trace-panel";
  panel.setAttribute("role", "tabpanel");
  const views = [
    { name: "Timeline", render: renderTimeline },
    { name: "Transaction", render: renderTransaction },
    { name: "JSON", render: renderJson },
  ];
  function setTab(index: number, focus = false) {
    tabList.querySelectorAll<HTMLButtonElement>("button").forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      if (i === index && focus) tab.focus();
    });
    panel.setAttribute("aria-labelledby", `tab-${index}`);
    panel.replaceChildren(views[index]!.render(trace));
  }
  views.forEach((view, index) => {
    const tab = el("button", "", view.name);
    tab.id = `tab-${index}`;
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    tab.onclick = () => setTab(index);
    tab.onkeydown = (event) => {
      let target: number;
      if (event.key === "ArrowRight") target = (index + 1) % views.length;
      else if (event.key === "ArrowLeft")
        target = (index + views.length - 1) % views.length;
      else if (event.key === "Home") target = 0;
      else if (event.key === "End") target = views.length - 1;
      else return;
      event.preventDefault();
      setTab(target, true);
    };
    tabList.append(tab);
  });
  $("inspector").replaceChildren(heading, info, tabList, panel);
  setTab(0);
}
async function load(append = false, preferId = "", quiet = false) {
  const current = ++revision;
  const query = new URLSearchParams({
    q: $<HTMLInputElement>("search").value,
    outcome: $<HTMLSelectElement>("outcome-filter").value,
    source: $<HTMLSelectElement>("source-filter").value,
    limit: String(append ? 30 : Math.max(30, entries.length)),
    offset: String(append ? (nextOffset ?? 0) : 0),
  });
  // The API caps pages at 100; poll only the loaded prefix when more pages are open.
  query.set("limit", String(Math.min(100, Number(query.get("limit")))));
  try {
    const page = await api<Page>(`/api/traces?${query}`);
    if (current !== revision) return;
    const previousKey = entries.map((entry) => entry.id).join(",");
    entries = append
      ? [
          ...entries,
          ...page.items.filter(
            (entry) => !entries.some((e) => e.id === entry.id),
          ),
        ]
      : page.items;
    total = page.total;
    nextOffset = page.nextOffset;
    if (append) nextOffset = entries.length < total ? entries.length : null;
    $("nav-count").textContent = String(page.stats.total);
    $("stat-total").textContent = String(page.stats.total);
    $("stat-delivered").textContent = String(page.stats.delivered);
    $("stat-issues").textContent = String(page.stats.issues);
    $("stat-undelivered").textContent = String(page.stats.settledUndelivered);
    const previousSelection = selectedId;
    if (preferId) selectedId = preferId;
    if (!entries.some((entry) => entry.id === selectedId))
      selectedId =
        (!previousSelection
          ? entries.find((e) => e.outcome === "delivery_failed")
          : undefined
        )?.id ??
        entries[0]?.id ??
        "";
    const changed = previousKey !== entries.map((entry) => entry.id).join(",");
    if (!quiet || changed) renderList();
    if (previousSelection !== selectedId || preferId) {
      if (selectedId) selectTrace(selectedId);
      else
        $("inspector").replaceChildren(
          el(
            "div",
            "empty",
            el("h3", "", "No request selected"),
            el(
              "p",
              "",
              "Change your filters or run a simulation to inspect a trace.",
            ),
          ),
        );
    }
    $("error-banner").hidden = true;
    $("connection").replaceChildren(
      el("span", "local-dot"),
      "Local session",
      el("kbd", "", "127.0.0.1"),
    );
  } catch (error) {
    if (current !== revision) return;
    $("error-banner").textContent =
      `Cannot load local traces. ${error instanceof Error ? error.message : "Check that the server is running."}`;
    $("error-banner").hidden = false;
    $("connection").textContent = "Disconnected";
  }
}
function openDialog(id: string) {
  $<HTMLDialogElement>(id).showModal();
}
function showSimulation() {
  $("simulation-error").textContent = "";
  openDialog("simulation-dialog");
}
for (const id of ["new-simulation", "nav-simulate", "banner-run", "empty-run"])
  $(id).addEventListener("click", showSimulation);
$("nav-devnet").onclick = () => {
  $("devnet-error").textContent = "";
  openDialog("devnet-dialog");
};
for (const button of document.querySelectorAll<HTMLButtonElement>(
  ".close-dialog",
))
  button.onclick = () => button.closest("dialog")?.close();
const descriptions: Record<string, string> = {
  success: "All five stages complete and the resource is delivered.",
  delivery_failed:
    "Payment settles, then the resource handler returns HTTP 500.",
  verification_failed:
    "The verifier rejects the fixture signature. Nothing is settled.",
  settlement_failed:
    "Verification passes, but the simulated network rejects settlement.",
  timeout:
    "Settlement exceeds a simulated 5-second deadline. The payment outcome is unknown.",
  server_error: "The API returns HTTP 503 before a payment is attempted.",
};
$<HTMLSelectElement>("scenario").onchange = () => {
  $("scenario-description").textContent =
    descriptions[$<HTMLSelectElement>("scenario").value] ?? "";
};
function resetFilters() {
  $<HTMLInputElement>("search").value = "";
  $<HTMLSelectElement>("outcome-filter").value = "all";
  $<HTMLSelectElement>("source-filter").value = "all";
  entries = [];
}
async function submit(
  form: HTMLFormElement,
  endpoint: string,
  data: unknown,
  buttonId: string,
  errorId: string,
  working: string,
  complete: string,
) {
  const button = $<HTMLButtonElement>(buttonId);
  const original = button.textContent;
  button.disabled = true;
  button.textContent = working;
  $(errorId).textContent = "";
  try {
    const trace = await api<Entry>(endpoint, data);
    form.closest("dialog")?.close();
    resetFilters();
    await load(false, trace.id);
    toast(complete);
  } catch (error) {
    $(errorId).textContent =
      error instanceof Error ? error.message : "Request failed. Try again.";
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
$<HTMLFormElement>("simulation-form").onsubmit = (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = Object.fromEntries(new FormData(form));
  void submit(
    form,
    "/api/simulations",
    data,
    "run-simulation",
    "simulation-error",
    "Running…",
    "Simulation saved locally",
  );
};
$<HTMLFormElement>("devnet-form").onsubmit = (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  void submit(
    form,
    "/api/devnet",
    { signature: $<HTMLTextAreaElement>("signature").value.trim() },
    "check-devnet",
    "devnet-error",
    "Checking Devnet…",
    "Devnet observation saved",
  );
};
let debounce: ReturnType<typeof setTimeout>;
$("search").addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    entries = [];
    void load();
  }, 200);
});
for (const id of ["outcome-filter", "source-filter"])
  $(id).addEventListener("change", () => {
    entries = [];
    void load();
  });
$("load-more").onclick = () => {
  void load(true);
};
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      (event.target as HTMLElement).tagName,
    ) &&
    !document.querySelector("dialog[open]")
  ) {
    event.preventDefault();
    $("search").focus();
  }
});
void load();
setInterval(() => {
  if (
    !document.hidden &&
    !document.querySelector("dialog[open]") &&
    entries.length <= 100 &&
    !$("search").matches(":focus")
  )
    void load(false, "", true);
}, 5000);
