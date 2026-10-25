import { z } from "zod";
import { signatureSchema, type Transaction } from "../domain/trace.js";

export const devnetRpc = "https://api.devnet.solana.com";
const resultSchema = z
  .object({
    slot: z.number().int().nonnegative(),
    blockTime: z.number().int().nullable(),
    meta: z
      .object({ err: z.json().nullable(), fee: z.number().int().nonnegative() })
      .nullable(),
    transaction: z.object({ signatures: z.array(z.string()).min(1) }),
  })
  .nullable();
const rpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.literal(1),
  result: resultSchema,
});
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}
export async function checkDevnet(
  signature: string,
  transport: typeof fetch = fetch,
): Promise<Transaction> {
  signatureSchema.parse(signature);
  let response: Response;
  try {
    response = await transport(devnetRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          signature,
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
            maxSupportedTransactionVersion: 1,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
  } catch (error) {
    throw new RpcError(
      error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
        ? "Devnet RPC timed out. Retry the same signature."
        : "Devnet RPC is unavailable. Retry the same signature.",
      504,
    );
  }
  if (!response.ok)
    throw new RpcError(
      `Devnet RPC returned HTTP ${response.status}. Retry later.`,
    );
  let raw: unknown;
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 1_000_000) throw new Error("Response too large");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RpcError("Devnet RPC returned malformed or oversized data.");
  }
  if (raw && typeof raw === "object" && "error" in raw)
    throw new RpcError("Devnet RPC reported an error. Retry later.");
  const parsed = rpcSchema.safeParse(raw);
  if (!parsed.success)
    throw new RpcError("Devnet RPC returned a malformed transaction.");
  const result = parsed.data.result;
  const base = { signature, checkedAt: new Date().toISOString() };
  if (!result) return { ...base, state: "not_found" };
  if (result.transaction.signatures[0] !== signature)
    throw new RpcError(
      "Devnet RPC returned a mismatched transaction signature.",
    );
  if (!result.meta)
    return {
      ...base,
      state: "unknown",
      slot: result.slot,
      blockTime: result.blockTime,
    };
  return {
    ...base,
    state: result.meta.err === null ? "confirmed" : "failed",
    slot: result.slot,
    blockTime: result.blockTime,
    feeLamports: result.meta.fee,
    ...(result.meta.err !== null
      ? { error: JSON.stringify(result.meta.err).slice(0, 1000) }
      : {}),
  };
}
