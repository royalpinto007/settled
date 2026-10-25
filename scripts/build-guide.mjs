import { cp, readFile, writeFile } from "node:fs/promises";
import { Marked, Renderer } from "marked";

export async function buildGuide() {
  const pages = [
    {
      input: "api.md",
      output: "guide.html",
      label: "Integration guide",
      intro: "Connect your application",
    },
    {
      input: "architecture.md",
      output: "architecture.html",
      label: "Architecture",
      intro: "How Settled? works",
    },
    {
      input: "local-setup.md",
      output: "setup.html",
      label: "Local setup",
      intro: "Run it your way",
    },
  ];
  const localLinks = Object.fromEntries(
    pages.map((page) => [page.input, `/${page.output}`]),
  );
  for (const diagram of ["architecture.svg", "payment-flow.svg"])
    await cp(`docs/${diagram}`, `dist/public/${diagram}`);
  for (const page of pages) {
    const sections = [];
    // Only trusted, version-controlled documentation is rendered at build time.
    // No captured metadata or runtime user input passes through this renderer.
    const markdown = new Marked({
      renderer: {
        image(token) {
          return `<a class="diagram-link" href="${token.href}">${Renderer.prototype.image.call(this, token)}</a>`;
        },
        link(token) {
          const [path, fragment] = token.href.split("#");
          const href = localLinks[path]
            ? `${localLinks[path]}${fragment ? `#${fragment}` : ""}`
            : token.href;
          return Renderer.prototype.link.call(this, { ...token, href });
        },
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
    const content = markdown
      .parse(await readFile(`docs/${page.input}`, "utf8"))
      .replaceAll("<pre>", '<pre tabindex="0">');
    const navigation = sections
      .map(({ id, label }) => `<a href="#${id}">${label}</a>`)
      .join("\n");
    await writeFile(
      `dist/public/${page.output}`,
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#101218" />
  <meta name="description" content="${page.label} for Settled?, the local-first x402 payment debugger for Solana." />
  <title>${page.label} | Settled?</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="/guide.css" />
</head>
<body class="docs-page">
  <a class="skip" href="#content">Skip to content</a>
  <header class="docs-header">
    <a class="brand" href="/" aria-label="Settled? home"><span class="brand-mark">S<span>?</span></span><span>settled<span class="brand-question">?</span></span></a>
    <span class="docs-breadcrumb">${page.label}</span>
    <a class="secondary" href="/">Back to requests</a>
  </header>
  <div class="docs-layout">
    <nav class="docs-navigation" aria-label="Guide sections">
      ${pages.map((item) => `<a class="docs-page-link" href="/${item.output}"${item.output === page.output ? ' aria-current="page"' : ""}>${item.label}</a>`).join("\n")}
      <p class="docs-toc-label">On this page</p>
      ${navigation}
      <div class="docs-local"><span class="local-dot"></span>Available offline</div>
    </nav>
    <main id="content" class="docs-content" tabindex="-1">
      <div class="docs-intro"><svg aria-hidden="true"><use href="/icons.svg#book"></use></svg>${page.intro}</div>
      ${content}
      <footer class="docs-footer">Free and open source. Your data stays local.</footer>
    </main>
  </div>
</body>
</html>`,
    );
  }
}
