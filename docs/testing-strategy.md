# Testing strategy

Field uses three layers. Add or extend tests at the lowest layer that can catch the regression.

| Layer | Tool | When to use |
| ----- | ---- | ----------- |
| **Unit** | Vitest (`npm test`) | Pure logic, shared helpers, server modules without full HTTP stack |
| **Integration** | Vitest (`npm run test:integration`) | API routes against Docker Postgres — mobile auth + crew scoping (`tests/integration/`); not run in CI yet |
| **Manual** | [`manual-test-overview.md`](manual-test-overview.md) | UI, cross-page flows, mobile/Capacitor, email console output, maps optional keys |

## Conventions

- Put unit specs in `tests/` as `*.test.ts` / `*.test.tsx`.
- Integration specs live in `tests/integration/`.
- Before a shared deploy, work through manual domains starting at P0 backlog items on the [project board](https://github.com/nolanvargas/Field/projects).
- CI runs `npm run lint`, `npm test`, and `npm run build` on every pull request.

Issue tracking and board workflow: [`dev-workflow.md`](dev-workflow.md).
