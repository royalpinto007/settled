#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

try {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      demo: { type: "boolean" },
      port: { type: "string" },
      "data-dir": { type: "string" },
    },
  });
  if (values.help) {
    console.log(`Settled? local payment debugger

Usage: settled [--demo] [--port 4402] [--data-dir ./data]

  --demo       Seed six simulated payment outcomes into an empty store
  --port       Local port, 1024 to 65535 (default: PORT or 4402)
  --data-dir   Local JSON directory (default: DATA_DIR or ./data)
  -h, --help   Show this help
  -v, --version Show the package version

Open the printed localhost URL. No wallet or funds are needed.`);
  } else if (values.version) {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    console.log(pkg.version);
  } else {
    if (values.port !== undefined) {
      const port = Number(values.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535)
        throw new Error("Port must be an integer from 1024 to 65535.");
      process.env.PORT = String(port);
    }
    if (values["data-dir"] !== undefined) {
      if (!values["data-dir"].trim())
        throw new Error("Data directory must not be empty.");
      process.env.DATA_DIR = values["data-dir"];
    }
    await import("./server.js");
  }
} catch (error) {
  console.error(
    `Settled?: ${error instanceof Error ? error.message : "Cannot start."}`,
  );
  process.exitCode = 1;
}
