import express from "express";
import type { ErrorRequestHandler } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  capture,
  captureSchema,
  diagnose,
  network,
  scenarioLabels,
  scenarios,
  signatureSchema,
  simulate,
  simulationSchema,
  traceSchema,
  type Trace,
} from "./domain/trace.js";
import { JsonStore, StoreFullError } from "./adapters/store.js";
import { checkDevnet, RpcError } from "./adapters/devnet.js";

const uuid = z.uuid();
const querySchema = z.strictObject({
  q: z.string().max(200).default(""),
  outcome: z.enum(["all", ...traceSchema.shape.outcome.options]).default("all"),
  source: z.enum(["all", "simulation", "capture", "devnet"]).default("all"),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const enrich = (trace: Trace) => ({ ...trace, diagnostic: diagnose(trace) });
export function createApp(store: JsonStore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
      strictTransportSecurity: false,
    }),
  );
  app.use((req, res, next) => {
    const host = req.headers.host ?? "";
    if (
      !/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host) ||
      (req.headers.origin && req.headers.origin !== `http://${host}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      res.status(403).json({
        error: {
          code: "local_access_only",
          message: "Access Settled? directly through its localhost URL.",
        },
      });
      return;
    }
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST" && !req.is("application/json")) {
      res.status(415).json({
        error: { code: "json_required", message: "Send application/json." },
      });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "64kb", strict: true }));
  app.get("/api/health", (_req, res) =>
    res.json({ status: "ok", local: true, network, count: store.all().length }),
  );
  app.get("/api/scenarios", (_req, res) =>
    res.json(scenarios.map((id) => ({ id, label: scenarioLabels[id] }))),
  );
  app.get("/api/traces", (req, res) => {
    const query = querySchema.parse(req.query);
    const all = store.all().reverse();
    const filtered = all.filter(
      (t) =>
        (query.outcome === "all" || t.outcome === query.outcome) &&
        (query.source === "all" || t.source === query.source) &&
        `${t.id} ${t.request.path} ${t.transaction?.signature ?? ""}`
          .toLowerCase()
          .includes(query.q.toLowerCase()),
    );
    const items = filtered
      .slice(query.offset, query.offset + query.limit)
      .map(enrich);
    res.json({
      items,
      total: filtered.length,
      nextOffset:
        query.offset + items.length < filtered.length
          ? query.offset + items.length
          : null,
      stats: {
        total: all.length,
        delivered: all.filter((t) => t.outcome === "delivered").length,
        issues: all.filter(
          (t) => !["delivered", "observed"].includes(t.outcome),
        ).length,
        settledUndelivered: all.filter((t) => t.outcome === "delivery_failed")
          .length,
      },
    });
  });
  app.post("/api/simulations", async (req, res) => {
    const trace = simulate(simulationSchema.parse(req.body));
    await store.add(trace);
    res.location(`/api/traces/${trace.id}`).status(201).json(enrich(trace));
  });
  app.post("/api/traces", async (req, res) => {
    const trace = capture(captureSchema.parse(req.body));
    await store.add(trace);
    res.location(`/api/traces/${trace.id}`).status(201).json(enrich(trace));
  });
  let rpcWindow = 0;
  let rpcCount = 0;
  let rpcActive = false;
  app.post("/api/devnet", async (req, res) => {
    const { signature } = z
      .strictObject({ signature: signatureSchema })
      .parse(req.body);
    if (Date.now() - rpcWindow >= 60_000) {
      rpcWindow = Date.now();
      rpcCount = 0;
    }
    if (rpcActive || rpcCount >= 12) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({
        error: {
          code: "rpc_rate_limit",
          message: "Wait before checking another Devnet transaction.",
        },
      });
      return;
    }
    rpcCount++;
    rpcActive = true;
    try {
      const transaction = await checkDevnet(signature);
      const trace: Trace = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        source: "devnet",
        request: { method: "POST", path: "/solana/getTransaction" },
        payment: null,
        events: [],
        outcome: "observed",
        transaction,
      };
      await store.add(trace);
      res.location(`/api/traces/${trace.id}`).status(201).json(enrich(trace));
    } finally {
      rpcActive = false;
    }
  });
  app.get("/api/export", (_req, res) =>
    res.attachment("settled-traces.json").json({
      version: 1,
      exportedAt: new Date().toISOString(),
      traces: store.all().map(enrich),
    }),
  );
  app.get("/api/traces/:id/export", (req, res) => {
    const trace = store.get(uuid.parse(req.params.id));
    if (!trace) {
      res.status(404).json({
        error: { code: "trace_not_found", message: "Trace not found." },
      });
      return;
    }
    res.attachment(`settled-${trace.id}.json`).json({
      version: 1,
      exportedAt: new Date().toISOString(),
      trace: enrich(trace),
    });
  });
  app.get("/api/traces/:id", (req, res) => {
    const trace = store.get(uuid.parse(req.params.id));
    if (!trace) {
      res.status(404).json({
        error: { code: "trace_not_found", message: "Trace not found." },
      });
      return;
    }
    res.json(enrich(trace));
  });
  app.use(
    express.static(fileURLToPath(new URL("./public/", import.meta.url)), {
      dotfiles: "deny",
      index: "index.html",
    }),
  );
  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "not_found", message: "Route not found." } }),
  );
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(422).json({
        error: {
          code: "invalid_input",
          message: "Check the request fields.",
          details: error.issues.map(({ path, message }) => ({
            path,
            message,
          })),
        },
      });
      return;
    }
    if (error instanceof RpcError) {
      res
        .status(error.status)
        .json({ error: { code: "devnet_rpc_error", message: error.message } });
      return;
    }
    if (error instanceof StoreFullError) {
      res
        .status(409)
        .json({ error: { code: "storage_full", message: error.message } });
      return;
    }
    const type = (error as { type?: string } | null)?.type;
    if (type === "entity.parse.failed" || type === "entity.too.large") {
      res.status(type === "entity.too.large" ? 413 : 400).json({
        error: {
          code: "invalid_body",
          message:
            type === "entity.too.large"
              ? "JSON body exceeds 64 KB."
              : "Invalid JSON body.",
        },
      });
      return;
    }
    console.error(
      "Settled? request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(500).json({
      error: {
        code: "internal_error",
        message:
          "The operation could not be saved. Check disk space and local directory permissions.",
      },
    });
  };
  app.use(errors);
  return app;
}
