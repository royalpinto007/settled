import { resolve } from "node:path";
import { z } from "zod";
import { createApp } from "./app.js";
import { JsonStore } from "./adapters/store.js";
import { simulate, scenarios } from "./domain/trace.js";

try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const port = z.coerce
  .number()
  .int()
  .min(1024)
  .max(65535)
  .default(4402)
  .parse(process.env.PORT);
const directory = resolve(process.env.DATA_DIR || "data");
const store = new JsonStore(directory);
try {
  await store.open();
  if (process.argv.includes("--demo") && store.all().length === 0) {
    const paths = [
      "/api/weather",
      "/api/research",
      "/api/embeddings",
      "/api/market-data",
      "/api/summarize",
      "/api/weather",
    ];
    for (const [index, scenario] of scenarios.entries())
      await store.add(simulate({ scenario, path: paths[index]! }));
  }
  const server = createApp(store).listen(port, "127.0.0.1", () => {
    console.log(
      `\nSettled? is running at http://127.0.0.1:${port}\nLocal data: ${directory}\nDemo payments are fixtures. No funds are moved.\n`,
    );
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      void store.close().then(() => {
        process.exitCode = 0;
      });
    });
    server.closeIdleConnections();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  server.on("error", async (error) => {
    console.error(`Cannot start Settled?: ${error.message}`);
    await store.close();
    process.exitCode = 1;
  });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Cannot open local storage.",
  );
  await store.close();
  process.exitCode = 1;
}
