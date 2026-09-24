# Testing strategy

Field uses **five automated layers** plus **manual domains** (human QA). Add coverage at the **lowest layer that can catch the regression** — do not skip unit tests because you plan to click through the UI later.

Related: Phase 2 test-depth work on the board (`phase:2-tests`, issues #3 / #9); process in [`dev-workflow.md`](dev-workflow.md).

| Layer | Command | CI |
| ----- | ------- | -- |
| Unit | `npm test` (local); `npm run test:coverage` (CI — thresholds on `shared/` + `server/`) | Yes — every PR |
| Integration | `npm run test:integration` | Yes — after unit tests (Postgres service) |
| Component (RTL) | `npm test` — `tests/**/*.test.tsx` with `@testing-library/react` | Yes — same job as unit |
| E2E smoke | `npm run test:e2e` (Playwright; starts API + Vite via [`scripts/e2e-serve.mjs`](../scripts/e2e-serve.mjs)) | Yes — after integration |
| Manual | [`manual-test-overview.md`](manual-test-overview.md) | N/A |

---

## When to use which layer

| You changed… | Prefer |
| ------------ | ------ |
| Pure function in `shared/`, formatting, validation rules, status transitions, permissions helpers | **Unit** — `tests/<module>.test.ts` |
| Server module with SQL or side effects (`server/*.mjs`) | **Unit** with mocked `db.mjs` / pool (see `tests/createTask.test.ts`) |
| HTTP route: status codes, auth gates, org scoping, real SQL constraints | **Integration** — `tests/integration/*.api.test.ts` |
| React component/modal behavior (validation, toggles, a11y) without full app boot | **RTL** — `tests/*.test.tsx`; use [`tests/helpers/renderUi.tsx`](../tests/helpers/renderUi.tsx) |
| Web shell routing, Vite proxy, stub auth + real API + Postgres | **E2E** — `e2e/*.spec.ts` |
| Capacitor WebView, maps, camera, Entra login, pixel-perfect PDF | **Manual domain** |
| Email/PDF generators and templates | **Unit** / **integration**; full SES/S3/visual judgment → **manual** |
| One-off script or dev-only route | Usually **no new test** — document in manual domain V if user-facing |

**Rule of thumb:** If the bug could be reproduced with only inputs and outputs (no browser, no real DB), it belongs in **unit** tests. If it needs Postgres + HTTP but not a browser, use **integration**. If it needs a mounted React tree with user events, use **RTL**. If it needs the real dev stack in a browser, use **E2E** (or manual when mobile/SSO).

---

## Unit tests (Vitest)

**Purpose:** Fast, deterministic checks on business logic. This is the default for new backend and shared code.

| | |
| - | - |
| **Run** | `npm test`, `npm run test:watch` |
| **Location** | `tests/**/*.test.ts` (and `.tsx` for component tests) |
| **Config** | [`vite.config.ts`](../vite.config.ts) — `jsdom` default; `tests/integration/**` and `e2e/**` excluded |
| **Setup** | [`tests/setup/rtl.setup.ts`](../tests/setup/rtl.setup.ts) — jest-dom, `matchMedia` / `ResizeObserver` shims for Mantine |
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

## Component tests (React Testing Library)

**Purpose:** Catch regressions in forms, modals, and controls without Playwright cost.

| | |
| - | - |
| **Run** | `npm test` (included in unit job) |
| **Harness** | `renderUi()` from [`tests/helpers/renderUi.tsx`](../tests/helpers/renderUi.tsx) — Mantine + dates providers |
| **Examples** | `tests/taskListViewSwitcher.test.tsx`, `tests/newTaskModal.validation.test.tsx` |

Mock API modules and `notify` when mounting heavy modals; prefer testing user-visible outcomes (error toast text, `aria-pressed`) over implementation details.

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

## E2E smoke (Playwright)

**Purpose:** One browser path through stub web auth, Vite `/api` proxy, and Postgres — catches wiring breaks unit/integration miss.

| | |
| - | - |
| **Run** | `npm run test:e2e` — debug UI: `npm run test:e2e:ui` |
| **Config** | [`playwright.config.ts`](../playwright.config.ts) — starts [`scripts/e2e-serve.mjs`](../scripts/e2e-serve.mjs) |
| **Spec** | [`e2e/tasks-board.smoke.spec.ts`](../e2e/tasks-board.smoke.spec.ts) |
| **Prerequisites (local)** | `docker compose up -d`, `npm run db:schema`, Sandbocks users (`npm run db:seed-dev-data` or `npm run db:reset`) |
| **Auth** | **Open stub API** — `FIELD_API_REQUIRE_AUTH` is **not** set (see [`docs/AGENTS/e2e-stub-auth.md`](AGENTS/e2e-stub-auth.md)) |

CI runs E2E after integration tests; fixture users (including Logan Reed) remain in Postgres from integration seeds.

---

## Manual domains

**Purpose:** Structured human QA for flows automated layers do not cover yet — full mobile UI, Capacitor, optional API keys, and console email inspection.

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

Use the [pull request template](../.github/pull_request_template.md): run `npm test`, and check **Manual: domain ___** when RTL/E2E cannot cover the change.

---

## Coverage gates

| Layer | Tool | Status |
| ----- | ---- | ------ |
| `shared/` + `server/` (excl. `server/index.mjs`) | `@vitest/coverage-v8` | **Done** — `vitest.coverage.config.ts` (55% lines/functions/statements, 50% branches) |

Future Phase 2 depth (issue #3): more integration around PDF/email/task pipelines — not the same as RTL/E2E smoke (#9).

---

## Checklist by change type

| Change type | Unit | Integration | RTL | E2E | Manual |
| ----------- | ---- | ----------- | --- | --- | ------ |
| New `shared/` helper | Required | — | — | — | — |
| New server function (no new route) | Required | Optional if SQL-heavy | — | — | — |
| New/changed API route | If logic is extractable | Strongly preferred | — | — | If UI-only consumer |
| React UI only | Extracted logic | — | Preferred for modals/controls | Shell/routing only | Name domain when gaps remain |
| Mobile / Capacitor | For pure TS helpers | For mobile API routes | — | — | **M** / **N** |
| PDF/email pipeline | Helpers + templates | Preferred for routes | — | — | **Q** / **R** |

---

## Commands (quick reference)

In the Vite dev server, **Development → Testing** (`/development/tests`) runs these scripts with live output and embeds this doc.

```bash
npm test                  # unit + RTL (fast)
npm run test:coverage     # unit + coverage thresholds (same as CI)
npm run test:watch        # unit while developing
npm run test:integration  # API + Postgres (local)
npm run test:e2e          # Playwright smoke (Postgres + auto-started API/Vite)
npm run test:e2e:ui       # Playwright interactive mode

docker compose up -d
npm run db:schema         # before integration, E2E, or manual reset
npm run db:reset          # Sandbocks seed for manual domains
npm run db:seed-dev-data  # users/venues/contacts only (E2E local if DB empty)
npm run dev               # web + API for manual QA
```

Issue tracking and board workflow: [`dev-workflow.md`](dev-workflow.md).
