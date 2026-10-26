# npm release

The package is `settled-debugger`, with the `settled` command. Releases are manual; no workflow publishes automatically.

## Check the candidate

```bash
npm ci
npm run check
npm run test:e2e
npm run package:check
```

The package check installs a tarball in a temporary directory and verifies the CLI, dashboard, offline documentation, seeded scenarios, simulation, JSON export and persistence. It never publishes. Save the verified candidate with:

```bash
node scripts/check-package.mjs --output /path/settled-debugger-0.1.0.tgz
```

Try it in a separate directory:

```bash
npm install /path/settled-debugger-0.1.0.tgz
npx settled --demo
```

## After approval

Confirm the target version is not already published, update the changelog and rerun all checks. Review the exact package file list with `npm pack --dry-run`. Use npm credentials only for the approved release; never commit a token or `.npmrc`.

After publication, verify `npx settled-debugger --demo` from a clean directory and tag the reviewed commit `v0.1.0`. No workflow publishes automatically.
