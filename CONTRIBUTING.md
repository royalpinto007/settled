# Contributing

Use Node.js 22.18+ and run `npm install`. Keep the runtime local-first and dependency-light. Do not introduce wallets, paid services, telemetry, databases or authentication into the MVP.

1. Add behavior-focused tests for changes. Use local fixtures for RPC tests, never funds or keys.
2. Run `npm run format`, `npm run check`, and `npm run test:e2e` after installing Chromium.
3. Document API changes and keep all payment fixtures explicitly labeled.
4. Use conventional commit messages such as `feat: add a scenario` or `fix: preserve failed delivery evidence`.

Never commit `.env`, data directories, signed payment payloads or keys. Report security issues privately through the repository owner's GitHub profile rather than posting sensitive evidence publicly.
