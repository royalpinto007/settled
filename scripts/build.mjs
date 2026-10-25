import { build } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
await mkdir("dist/public", { recursive: true });
await cp("public", "dist/public", { recursive: true });
await build({
  entryPoints: ["src/web/app.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/public/app.js",
  target: "es2022",
});
