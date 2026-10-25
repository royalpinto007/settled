import { readFile, writeFile } from "node:fs/promises";
import { marked, Renderer } from "marked";

export async function buildGuide() {
  const sections = [];
  // Only trusted, version-controlled documentation is rendered at build time.
  // No captured metadata or runtime user input passes through this renderer.
  marked.use({
    renderer: {
      table(token) {
        return `<div class="docs-table">${Renderer.prototype.table.call(this, token)}</div>`;
      },
      heading({ text, tokens, depth }) {
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const label = this.parser.parseInline(tokens);
        if (depth === 2) sections.push({ id, label });
        return `<h${depth} id="${id}">${label}</h${depth}>\n`;
      },
    },
  });
  const content = marked
    .parse(await readFile("docs/api.md", "utf8"))
    .replaceAll("<pre>", '<pre tabindex="0">');
  const navigation = sections
    .map(({ id, label }) => `<a href="#${id}">${label}</a>`)
    .join("\n");
  await writeFile(
    "dist/public/guide.html",
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#101218" />
  <meta name="description" content="Connect your application to Settled?. Local API endpoints, capture examples, Devnet observations and error codes." />
  <title>Integration guide | Settled?</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="/guide.css" />
</head>
<body class="docs-page">
  <a class="skip" href="#content">Skip to API reference</a>
  <header class="docs-header">
    <a class="brand" href="/" aria-label="Settled? home"><span class="brand-mark">S<span>?</span></span><span>settled<span class="brand-question">?</span></span></a>
    <span class="docs-breadcrumb">Integration guide</span>
    <a class="secondary" href="/">Back to requests</a>
  </header>
  <div class="docs-layout">
    <nav class="docs-navigation" aria-label="Guide sections">
      <p>On this page</p>
      <a href="#local-api">Overview and endpoints</a>
      ${navigation}
      <div class="docs-local"><span class="local-dot"></span>Available offline</div>
    </nav>
    <main id="content" class="docs-content" tabindex="-1">
      <div class="docs-intro"><svg aria-hidden="true"><use href="/icons.svg#book"></use></svg>Connect your application</div>
      ${content}
      <footer class="docs-footer">Your application reports the evidence. Settled? helps you inspect it.</footer>
    </main>
  </div>
</body>
</html>`,
  );
}
