# Dev Testing hub (`/development/tests`)

- Dev-only (`import.meta.env.DEV`). Production builds redirect away.
- **Vitest catalog:** `GET /api/dev/tests` from `scripts/vite-test-catalog.mjs` (Vite middleware, not Node API).
- **Integration/E2E file list:** `GET /api/dev/testing-inventory` (same plugin; globs `tests/integration/**/*.api.test.ts` and `e2e/**/*.spec.ts`).
- **Run scripts:** reuses `scripts/vite-npm-scripts.mjs` (`/api/dev/npm-scripts/run` + SSE stream).
- **Embedded markdown:** `src/pages/DevTestsPage.tsx` imports `docs/testing-strategy.md`, `docs/manual-test-overview.md`, and `docs/pilot-uat-script.md` via `?raw`. Edit those files and refresh Vite — no duplicate copy in React.
- **IDE file links:** optional `dev-tests.links.local.json` at repo root (`workspaceRoot`, `urlScheme`) — same as Vitest catalog links.
