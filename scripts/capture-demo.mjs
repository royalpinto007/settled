import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    output: { type: "string" },
    replace: { type: "boolean" },
    inspect: { type: "boolean" },
    verify: { type: "boolean" },
    "keep-capture": { type: "boolean" },
  },
});
const output = resolve(
  values.output || join(homedir(), "Downloads", "settled-demo.mp4"),
);
if (!values.replace && !values.verify) {
  try {
    await access(output);
    throw new Error("Demo exists. Use --replace to regenerate it.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await mkdir(dirname(output), { recursive: true });
const work = await mkdtemp(join(tmpdir(), "settled-video-"));
console.log(`Render workspace: ${work}`);
try {
  const render = spawn(
    process.execPath,
    [
      "scripts/render-demo.mjs",
      work,
      output,
      ...(values.inspect ? ["--inspect"] : []),
      ...(values.verify ? ["--verify"] : []),
    ],
    { stdio: "inherit" },
  );
  const [code] = await once(render, "exit");
  if (code !== 0) throw new Error(`Video renderer exited with ${code}`);
} finally {
  if (values.inspect || values["keep-capture"]) console.log(`Retained ${work}`);
  else await rm(work, { recursive: true, force: true });
}
