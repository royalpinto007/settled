import { randomUUID } from "node:crypto";
import { z } from "zod";

export const network = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const stages = [
  "request",
  "challenge",
  "verification",
  "settlement",
  "delivery",
] as const;
export const scenarios = [
  "success",
  "delivery_failed",
  "verification_failed",
  "settlement_failed",
  "timeout",
  "server_error",
] as const;
export const scenarioLabels: Record<(typeof scenarios)[number], string> = {
  success: "Successful payment",
  delivery_failed: "Paid, delivery failed",
  verification_failed: "Verification rejected",
  settlement_failed: "Settlement failed",
  timeout: "Settlement timeout",
  server_error: "Server error",
};
const requestSchema = z.strictObject({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^\/[a-zA-Z0-9/_:.{}-]*$/, "Use a path without query parameters"),
});
const paymentSchema = z.strictObject({
  amount: z.string().regex(/^\d{1,20}$/),
  asset: z.string().min(1).max(64),
  recipient: z.string().max(64).optional(),
  network: z.literal(network),
});
export const eventSchema = z.strictObject({
  stage: z.enum(stages),
  status: z.enum(["success", "failure", "timeout", "skipped"]),
  atMs: z.number().int().min(0).max(86_400_000),
  durationMs: z.number().int().min(0).max(86_400_000),
  detail: z.string().min(1).max(500),
  httpStatus: z.number().int().min(100).max(599).optional(),
});
export type TraceEvent = z.infer<typeof eventSchema>;
const eventsSchema = z
  .array(eventSchema)
  .length(5)
  .superRefine((events, ctx) => {
    let stopped = false;
    let end = 0;
    events.forEach((event, index) => {
      if (
        event.stage !== stages[index] ||
        event.atMs < end ||
        (stopped && event.status !== "skipped")
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Events must follow the lifecycle in order; stages after failure must be skipped",
        });
      if (event.status !== "success") stopped = true;
      end = event.atMs + event.durationMs;
      if (end > 86_400_000)
        ctx.addIssue({
          code: "custom",
          message: "Timeline cannot exceed 24 hours",
        });
    });
  });
export const signatureSchema = z
  .string()
  .regex(
    /^[1-9A-HJ-NP-Za-km-z]{64,88}$/,
    "Enter a base58 Solana transaction signature",
  );
export const transactionSchema = z.strictObject({
  signature: z.string().max(100),
  state: z.enum(["simulated", "confirmed", "failed", "not_found", "unknown"]),
  slot: z.number().int().nonnegative().optional(),
  feeLamports: z.number().int().nonnegative().optional(),
  blockTime: z.number().int().nullable().optional(),
  checkedAt: z.iso.datetime().optional(),
  error: z.string().max(1000).optional(),
});
export const captureSchema = z.strictObject({
  request: requestSchema,
  payment: paymentSchema,
  events: eventsSchema,
  signature: signatureSchema.optional(),
});
export const simulationSchema = z.strictObject({
  scenario: z.enum(scenarios),
  path: requestSchema.shape.path.default("/api/weather"),
  method: requestSchema.shape.method.default("GET"),
  amount: paymentSchema.shape.amount.default("10000"),
});
export const traceSchema = z.strictObject({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  source: z.enum(["simulation", "capture", "devnet"]),
  scenario: z.enum(scenarios).optional(),
  request: requestSchema,
  payment: paymentSchema.nullable(),
  events: z.array(eventSchema).max(5),
  outcome: z.enum([
    "delivered",
    "payment_failed",
    "delivery_failed",
    "timeout",
    "error",
    "observed",
  ]),
  transaction: transactionSchema.optional(),
});
export type Trace = z.infer<typeof traceSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export function outcomeOf(events: TraceEvent[]): Trace["outcome"] {
  if (events.some((e) => e.status === "timeout")) return "timeout";
  if (events[0]?.status === "failure") return "error";
  if (events[4]?.status === "failure") return "delivery_failed";
  if (events[2]?.status === "failure" || events[3]?.status === "failure")
    return "payment_failed";
  if (events[4]?.status === "success") return "delivered";
  return "observed";
}
export function capture(input: z.infer<typeof captureSchema>): Trace {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: "capture",
    request: input.request,
    payment: input.payment,
    events: input.events,
    outcome: outcomeOf(input.events),
    ...(input.signature
      ? {
          transaction: {
            signature: input.signature,
            state: "unknown" as const,
          },
        }
      : {}),
  };
}
export function simulate(raw: z.input<typeof simulationSchema>): Trace {
  const input = simulationSchema.parse(raw);
  const scenario = input.scenario;
  const failureStage = {
    success: -1,
    delivery_failed: 4,
    verification_failed: 2,
    settlement_failed: 3,
    timeout: 3,
    server_error: 0,
  }[scenario];
  const details = [
    "Request received by the local sandbox.",
    "402 Payment Required returned with a fixture USDC requirement.",
    "Fixture payment accepted by the simulated verifier.",
    "Fixture transaction marked settled. No transaction was broadcast.",
    "Resource delivered successfully with HTTP 200.",
  ];
  const failures: Record<string, string> = {
    delivery_failed:
      "HTTP 500 after fixture settlement. The resource was not delivered.",
    verification_failed:
      "Fixture signature rejected. Settlement was not attempted.",
    settlement_failed: "Simulated transaction rejected by the network.",
    timeout:
      "No settlement confirmation within the simulated 5,000 ms deadline. Outcome unknown.",
    server_error:
      "HTTP 503 before the payment challenge. No payment was attempted.",
  };
  let atMs = 0;
  const events: TraceEvent[] = stages.map((stage, index) => {
    const skipped = failureStage >= 0 && index > failureStage;
    const failed = index === failureStage;
    const durationMs = skipped
      ? 0
      : failed && scenario === "timeout"
        ? 5000
        : [8, 12, 64, 280, 36][index]!;
    const event: TraceEvent = {
      stage,
      status: skipped
        ? "skipped"
        : failed
          ? scenario === "timeout"
            ? "timeout"
            : "failure"
          : "success",
      atMs,
      durationMs,
      detail: skipped
        ? "Not attempted after the preceding failure."
        : failed
          ? failures[scenario]!
          : details[index]!,
    };
    if (stage === "challenge" && !skipped) event.httpStatus = 402;
    if (stage === "delivery" && !skipped) event.httpStatus = failed ? 500 : 200;
    if (stage === "request" && failed) event.httpStatus = 503;
    atMs += durationMs;
    return event;
  });
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: "simulation",
    scenario,
    request: { method: input.method, path: input.path },
    payment: {
      amount: input.amount,
      asset: "USDC (fixture)",
      recipient: "sandbox-recipient",
      network,
    },
    events,
    outcome: outcomeOf(events),
    ...(failureStage === -1 || failureStage >= 3
      ? {
          transaction: {
            signature: `sim_${randomUUID().replaceAll("-", "")}`,
            state: "simulated" as const,
          },
        }
      : {}),
  };
}
export function diagnose(trace: Trace): {
  tone: "good" | "bad" | "warn";
  title: string;
  advice: string;
} {
  if (trace.source === "devnet")
    return {
      tone: trace.transaction?.state === "confirmed" ? "good" : "warn",
      title: `Devnet transaction: ${trace.transaction?.state.replaceAll("_", " ") ?? "unknown"}`,
      advice:
        "This is a chain observation only. Confirm recipient, asset, amount, authorization and resource delivery in your x402 integration separately.",
    };
  const failed = trace.events.find(
    (e) => e.status === "failure" || e.status === "timeout",
  );
  if (trace.outcome === "delivery_failed")
    return {
      tone: "bad",
      title: "Payment settled. Delivery failed.",
      advice:
        "Inspect the resource handler and correlate its logs with this request. Recover delivery using your purchase ID; do not create another payment for the same purchase.",
    };
  if (trace.outcome === "timeout")
    return {
      tone: "warn",
      title: "Settlement outcome is unknown.",
      advice:
        "Check the existing transaction signature before retrying. A confirmation timeout does not establish that the payment failed. Avoid creating a second payment.",
    };
  if (failed?.stage === "verification")
    return {
      tone: "bad",
      title: "Payment verification rejected.",
      advice:
        "Compare the selected requirement with the payload: network, mint, recipient, amount, expiry and signature. Do not settle or deliver until verification succeeds.",
    };
  if (failed?.stage === "settlement")
    return {
      tone: "bad",
      title: "Settlement failed. No delivery attempted.",
      advice:
        "Inspect the transaction error and payer balance. Check blockhash expiry and facilitator policy before retrying with the same purchase identifier.",
    };
  if (trace.outcome === "error")
    return {
      tone: "bad",
      title: "Request failed before payment.",
      advice:
        "Inspect server availability and the resource route. The payment challenge was never issued, so no settlement should have been attempted.",
    };
  if (trace.outcome === "observed")
    return {
      tone: "warn",
      title: "Lifecycle evidence is incomplete.",
      advice:
        "Capture the remaining verification, settlement and delivery outcomes before deciding whether this request succeeded.",
    };
  return {
    tone: "good",
    title: "Payment and delivery completed.",
    advice:
      trace.source === "simulation"
        ? "The sandbox completed every stage. Try a delivery failure to see how a successful payment can still produce a failed request."
        : "The captured lifecycle reports successful verification, settlement and delivery. Captured events are caller-reported evidence.",
  };
}
