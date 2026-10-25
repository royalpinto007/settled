import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { traceSchema, type Trace } from "../domain/trace.js";

const fileSchema = z.strictObject({
  version: z.literal(1),
  traces: z.array(traceSchema).max(1000),
});
export class JsonStore {
  private traces: Trace[] = [];
  private queue: Promise<void> = Promise.resolve();
  private lock?: FileHandle;
  constructor(private readonly directory: string) {}
  async open() {
    if (this.lock) throw new Error("Store is already open");
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      this.lock = await open(join(this.directory, ".lock"), "wx", 0o600);
    } catch {
      throw new Error(
        "Data directory is locked. Stop the other Settled? process. After a crash, remove .lock only after confirming no instance is running.",
      );
    }
    try {
      await this.lock.writeFile(String(process.pid));
      const path = join(this.directory, "traces.json");
      try {
        if ((await stat(path)).size > 20_000_000)
          throw new Error("Storage too large");
        this.traces = fileSchema.parse(
          JSON.parse(await readFile(path, "utf8")),
        ).traces;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          throw new Error(
            "Local trace storage is corrupt or unsupported. Back it up and repair it before restarting.",
            { cause: error },
          );
        this.traces = [];
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  all(): Trace[] {
    return structuredClone(this.traces);
  }
  get(id: string): Trace | undefined {
    return structuredClone(this.traces.find((trace) => trace.id === id));
  }
  add(trace: Trace): Promise<void> {
    const parsed = traceSchema.parse(trace);
    const task = this.queue.then(async () => {
      if (!this.lock) throw new Error("Store is closed");
      if (this.traces.length >= 1000) throw new StoreFullError();
      if (this.traces.some((item) => item.id === parsed.id))
        throw new Error("Duplicate trace ID");
      const next = [...this.traces, parsed];
      const temporary = join(this.directory, "traces.json.tmp");
      const handle = await open(temporary, "w", 0o600);
      try {
        await handle.writeFile(
          JSON.stringify({ version: 1, traces: next }, null, 2),
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, join(this.directory, "traces.json"));
      this.traces = next;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  async close() {
    await this.queue;
    if (this.lock) {
      await this.lock.close();
      this.lock = undefined;
      await rm(join(this.directory, ".lock"), { force: true });
    }
  }
}
export class StoreFullError extends Error {
  constructor() {
    super(
      "Storage has 1,000 traces. Export and archive your data directory, then start with a new DATA_DIR.",
    );
  }
}
