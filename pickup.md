# Pickup


| Snapshot                                                | Value                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Last checked                                            | 2026-09-20                                                            |
| Vitest (`npm test`)                                     | 87 files · 951 tests · green                                         |
| Integration (`npm run test:integration`)                | 4 files · 24 tests · green (CI + local Postgres)                     |
| Project board                                           | [Field projects](https://github.com/nolanvargas/Field/projects)       |
| Workflow doc                                            | [`docs/dev-workflow.md`](docs/dev-workflow.md)                        |
| `docker compose up -d` `npm run dev` `npm run db:reset` |                                                                       |

---

## This week

<!-- 1–3 GitHub issue numbers you are actively driving; update when priorities shift -->

| # | Issue | Status column |
| - | ----- | ------------- |
|   |       |               |


---

## Gaps {#gaps}


| Area      | Gap                                                | Blocker for shared deploy? | Detail                                                                         |
| --------- | -------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| Manual QA | 22 domains unchecked                               | Medium                     | `[docs/manual-test-overview.md](docs/manual-test-overview.md)`                 |
| Tests     | No E2E · minimal React tests                       | Medium                     | 951 Vitest unit tests in CI; `npm run test:integration` local only             |
| Mobile    | No real push                                       | No                         | NotificationsPage = local test buttons only                                    |

---



## Priority {#priority}


| Rank | Work                                        | Reduces                     | Doc / entry                                                    |
| ---- | ------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| 1    | **Pilot UAT** — run script ×2 on clean DB   | Phase 1 exit                | [`docs/pilot-uat-script.md`](docs/pilot-uat-script.md)         |
| 2    | Manual QA — one domain per session          | Unknown regressions         | [`docs/manual-test-overview.md`](docs/manual-test-overview.md) |
| 3    | MVP scope checklist sign-off                | Building wrong features     | [`docs/mvp-scope-checklist.md`](docs/mvp-scope-checklist.md)   |
| 4    | Phase 2 — RTL + Playwright E2E              | Silent UI regressions       | [`docs/roadmap.md`](docs/roadmap.md) Phase 2                  |
| 5    | AWS / Alpha deploy                          | Cloud pilot                 | [`docs/roadmap.md`](docs/roadmap.md) Phase 3+                  |


Phases 0–5 detail: `[docs/roadmap.md](docs/roadmap.md)`.

---



### Default test users


| Role                   | Name        | Email                                                     |
| ---------------------- | ----------- | --------------------------------------------------------- |
| Admin (default picker) | Logan Reed  | [logan.reed@example.com](mailto:logan.reed@example.com)   |
| Crew only              | Alex Rivera | [alex.rivera@example.com](mailto:alex.rivera@example.com) |
| Admin alt              | Nina Ortiz  | [nina.ortiz@example.com](mailto:nina.ortiz@example.com)   |


---



## Decision matrix


| Question                              | Yes →                                                                 | No →                              |
| ------------------------------------- | --------------------------------------------------------------------- | --------------------------------- |
| Blocks real users on a shared server? | Security / `taskAccess` (Analysis + Dev)                              | ↓ next row                        |
| Behavior defined in docs?             | ↓ next row                                                            | Analysis — write in `docs/` first |
| Covered by auto or manual test?       | ↓ next row                                                            | Testing — Vitest or manual domain |
| Missing for agreed MVP?               | unknown → Analysis (scope checklist) · yes → Dev · no → Defer or polish | —                               |


---



## Maintenance


| Trigger                 | Update in this file        |
| ----------------------- | -------------------------- |
| Manual domain completed | Gap matrix · manual QA row |
| Roadmap phase exit met  | Built / Gap matrices       |
| Major feature shipped   | Built matrix               |
| Test count changed      | Snapshot row               |
| Issue closed / reprioritized | This week table · gap matrix |


