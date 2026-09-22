# Testing strategy

Field uses **three layers** today: Vitest unit tests (CI), Vitest API integration tests (local, Postgres), and **manual domains** (human QA). Add coverage at the **lowest layer that can catch the regression** — do not skip unit tests because you plan to click through the UI later.

Related: Phase 2 test-depth work on the board (`phase:2-tests`, issues #3 / #9); process in [`dev-workflow.md`](dev-workflow.md).

| Layer | Command | CI |
| ----- | ------- | -- |
| Unit | `npm test` (local); `npm run test:coverage` (CI — thresholds on `shared/` + `server/`) | Yes — every PR |
| Integration | `npm run test:integration` | Yes — after unit tests (Postgres service) |
| Manual | [`manual-test-overview.md`](manual-test-overview.md) | N/A |

---

## When to use which layer

| You changed… | Prefer |
| ------------ | ------ |
| Pure function in `shared/`, formatting, validation rules, status transitions, permissions helpers | **Unit** — `tests/<module>.test.ts` |
| Server module with SQL or side effects (`server/*.mjs`) | **Unit** with mocked `db.mjs` / pool (see `tests/createTask.test.ts`) |
| HTTP route: status codes, auth gates, org scoping, real SQL constraints | **Integration** — `tests/integration/*.api.test.ts` |
| React page/modal layout, keyboard, mobile WebView, maps, camera, Entra login | **Manual domain** (until RTL / Playwright land in Phase 2) |
| Email/PDF end-to-end (SES, S3, pixel-perfect layout) | **Unit** for generators/helpers; **manual** or integration for full pipeline |
| One-off script or dev-only route | Usually **no new test** — document in manual domain V if user-facing |

**Rule of thumb:** If the bug could be reproduced with only inputs and outputs (no browser, no real DB), it belongs in **unit** tests. If it needs Postgres + HTTP but not a browser, use **integration**. If it needs Capacitor, SSO, or visual judgment, use a **manual domain**.

---

## Unit tests (Vitest)

**Purpose:** Fast, deterministic checks on business logic. This is the default for new backend and shared code.

| | |
| - | - |
| **Run** | `npm test`, `npm run test:watch` |
| **Location** | `tests/**/*.test.ts` (and `.tsx` when component tests exist) |
| **Config** | [`vite.config.ts`](../vite.config.ts) — `jsdom` default; `tests/integration/**` excluded |
| **Environment** | Add `/** @vitest-environment node */` when the module needs Node APIs (most `server/` tests) |

### Good unit-test targets

- `shared/*` — task fields, imports, tracking, document tags, clustering, etc.
- `server/*` — call exported functions directly; mock `getPool`, email, storage with `vi.mock` (pattern in `tests/createTask.test.ts`, `tests/auth.helpers.test.ts`).
- Client utilities that do not mount React — parsing, prefs, URL builders.

### Avoid in unit tests

- Starting the full API server and hitting routes (use integration instead).
- Depending on Docker Postgres or files under `storage/` (mock or use temp dirs in isolation).
- Asserting pixel layout or third-party map tiles.

### Adding a unit test

1. Name the file after the module: `tests/taskEditHistory.test.ts` for `shared/taskEditHistory.js`.
2. Keep cases focused — one behavior per `it(...)`.
3. Run `npm test` before opening a PR (CI runs the same suite).

---

## Integration tests (Vitest + Postgres)

**Purpose:** Prove API routes behave correctly with a real database — auth mode, constraints, and scoping that mocks hide.

| | |
| - | - |
| **Run** | `npm run test:integration` (sets `FIELD_API_REQUIRE_AUTH=1`; uses [`vitest.integration.config.ts`](../vitest.integration.config.ts)) |
| **Prerequisites** | `docker compose up -d`, `npm run db:schema` |
| **Location** | `tests/integration/` — helpers in `tests/integration/helpers/` |
| **CI** | GitHub Actions — Postgres service + `db:schema` before `test:integration` |

Specs skip automatically when Postgres is unreachable (`describe.skipIf(!postgresUp)`).

### Good integration-test targets

- New or changed `server/index.mjs` routes (especially mobile auth and task scoping).
- Flows where SQL errors, FK violations, or transaction boundaries matter.
- Regression tests for security gaps (e.g. crew member must not read unassigned tasks).

### Current coverage

- `mobileAuth.api.test.ts` — activation, revoke, session headers.
- `mobileCrewScoping.api.test.ts` — list/detail access for device sessions.
- `tasksWeb.api.test.ts` — web Bearer auth, task create (validation + crew), view scoping, status PATCH (illegal 409, Unassigned→In Progress chain), attachments, crew-events, print 403.
- `taskTerminalEmail.api.test.ts` — terminal status → `email_deliveries` (`task_completed`, `task_failed` triggers).
- `taskPrint.api.test.ts` — `POST /api/print/delivery_docket` returns PDF bytes and persists `task_documents` (fixtures seed `org_print_templates`).

### Adding an integration test

1. Add `*.api.test.ts` under `tests/integration/`.
2. Reuse `startTestApi`, `withCommittedDb`, and fixtures in `helpers/`.
3. Run `npm run test:integration` locally before merge; note in PR if you could not run Postgres.

---

## Manual domains

**Purpose:** Structured human QA for flows that automated layers do not cover yet — full UI, Capacitor, optional API keys, and console email inspection.

| | |
| - | - |
| **Index** | [`manual-test-overview.md`](manual-test-overview.md) — domains **A–V** with progress checkboxes |
| **Deep dives** | `docs/manual-test/<domain>.md` (created when a domain needs step-by-step scripts) |
| **Setup** | Sandbocks + `npm run db:reset` — see overview **Shared setup** |

### When to run manual QA

| Situation | Suggested domain(s) |
| --------- | ------------------- |
| Auth, permissions, stub vs Entra | **A** |
| Tasks board, filters, modals | **C**, **E**, **F** |
| Status / cancel / restore / clone | **G** |
| Mobile QR, crew execution, photos | **M**, **N** |
| Email triggers | **Q** (+ watch API terminal with `EMAIL_PROVIDER=console`) |
| PDF view/generation | **R** |
| API-only feature (e.g. route optimize) | **U** |

Pick **one domain per session**, complete it, then check the box in the overview (agents: add date under **Completed**).

### PRs that touch UI or cross-cutting behavior

Use the [pull request template](../.github/pull_request_template.md): run `npm test`, and check **Manual: domain ___** when automated tests cannot cover the change.

---

## Planned layers (Phase 2 — not required today)

From Phase 2 test-depth goals (board / issues #3 / #9):

| Layer | Tool | When it lands |
| ----- | ---- | ------------- |
| Component | `@testing-library/react` | Forms/modals (e.g. `NewTaskModal` validation) without full browser |
| E2E | Playwright (target) | Golden paths: web create → mobile complete → email logged |
| Coverage gates | `@vitest/coverage-v8` | **Done** — `vitest.coverage.config.ts` (55% lines/functions/statements, 50% branches; excludes `server/index.mjs`) |

Until then, do not block PRs for missing RTL/Playwright — add unit or integration tests where possible and name the manual domain for the rest.

---

## Checklist by change type

| Change type | Unit | Integration | Manual |
| ----------- | ---- | ----------- | ------ |
| New `shared/` helper | Required | — | — |
| New server function (no new route) | Required | Optional if SQL-heavy | — |
| New/changed API route | If logic is extractable | Strongly preferred | If UI-only consumer |
| React UI only | Only for extracted logic | — | Name domain in PR |
| Mobile / Capacitor | For pure TS helpers | For mobile API routes | **M** / **N** |
| PDF/email pipeline | Helpers + templates | Future | **Q** / **R** |

---

## Commands (quick reference)

```bash
npm test                  # unit (fast)
npm run test:coverage     # unit + coverage thresholds (same as CI)
npm run test:watch        # unit while developing
npm run test:integration  # API + Postgres (local)

docker compose up -d
npm run db:schema         # before integration or manual reset
npm run db:reset          # Sandbocks seed for manual domains
npm run dev               # web + API for manual QA
```

Issue tracking and board workflow: [`dev-workflow.md`](dev-workflow.md).
