# Field — Engineering & Product Roadmap

**Purpose:** Compare where Field is today against what a **properly developed** field-workforce management (FWM) application of this size and scope would look like at full maturity — from foundational basics through to production-grade “100%.”

**Audience:** Engineers, product owners, and agents scoping work.

**Related:** [`sdd.md`](sdd.md) · [`critical-features.md`](critical-features.md) · [`AGENTS.md`](../AGENTS.md)

**Last updated:** 2026-09-06

---

## Executive summary

Field is past the “empty repo” stage and into **active build**: a working local stack, a broad feature surface (tasks, contacts, addresses, org settings, mobile QR auth, PDFs, emails, import), and a **partial** automated test suite. It is **not** yet a production-ready, fully hardened replacement for a licensed FWM product.

| Dimension | Rough maturity | One-line assessment |
| --------- | -------------- | ------------------- |
| **Overall** | **~40%** | Strong local-dev foundation and wide feature coverage; weak on CI, test depth, security hardening, and production ops |
| Core product (web + mobile) | ~55% | Main flows exist; gaps in notifications, shipping label, and licensed-product parity |
| Critical pipeline (PDF + email) | ~65% | Docket + POD + terminal emails work; shipping label and event-driven generation missing |
| Security & authorization | ~50% | Permissions model exists; several mobile/web scoping gaps documented in SDD |
| Automated testing | ~25% | Good unit tests for pure logic; no component, API integration, or E2E tests; no CI gate |
| CI/CD & environments | ~5% | No GitHub Actions; staging infra removed; deploy is manual |
| Production infrastructure | ~10% | Abstractions exist (storage, email); AWS not provisioned |
| Observability & ops | ~5% | Console logging only; no error tracking, metrics, or runbooks |
| Mobile distribution | ~40% | Capacitor shell works; signing docs exist; push is prototype-only |
| Documentation | ~60% | SDD and schema docs are solid; API/runbook/ops docs thin |

**Bottom line:** Field is a credible **local MVP in progress**, not a shippable production system. The gap to “100%” is mostly **quality gates, security hardening, production ops, and licensed-product parity** — not starting from zero.

---

## How to read this document

### Maturity scale

| Range | Label | Meaning |
| ----- | ----- | ------- |
| 0–20% | **Absent** | Not started or only sketched |
| 21–40% | **Started** | Works in dev; incomplete, untested, or not enforced |
| 41–60% | **Functional** | Usable for internal pilot; known gaps |
| 61–80% | **Hardened** | Tested, scoped, deployable to a real environment |
| 81–100% | **Production-grade** | Monitored, recoverable, documented, parity-validated |

### “100%” definition

For Field, **100%** means:

1. **Licensed-product parity** on agreed MVP scope (task create → assign → execute → complete, PDFs, emails, crew mobile, public tracking).
2. **Production deployment** on AWS (or chosen host) with staging + production environments.
3. **Security** — auth, authorization, and data scoping enforced and tested; no documented “intent only” gaps.
4. **Automated quality** — CI runs lint + tests on every PR; coverage targets on critical paths; at least one E2E smoke flow.
5. **Operability** — monitoring, alerting, backups, email deliverability, and runbooks an on-call engineer can follow.
6. **Mobile** — signed internal builds, QR activation, durable sessions, revocable devices, crew flows on real hardware.

100% is **not** infinite feature creep (payroll integrations, multi-tenant SaaS, offline-first, etc.) unless explicitly added to scope.

---

## Current inventory (baseline)

Useful counts as of this writing:

| Asset | Count / status |
| ----- | -------------- |
| Frontend (`src/`) | ~103 TS/TSX files, ~15 pages, ~50+ components |
| Backend (`server/`) | ~37 modules; monolithic `index.mjs` route handler |
| Database | 53 migrations; org settings, custom fields, permissions, mobile auth |
| Unit/integration tests | 27 files, ~203 tests (1 currently failing) |
| Component / E2E tests | 0 |
| CI pipeline | None |
| Docs | 8 files under `docs/` + `AGENTS.md` |

**Test suite health:** `npm test` — 202 pass, 1 fail (`requiredTaskFields` label drift). Tests are not enforced in CI.

**README discrepancy:** README mentions “Vitest + Testing Library” but `@testing-library/react` is not installed; `jsdom` is configured but unused for components.

---

## Pillar-by-pillar comparison

### 1. Local development environment

| At 100% | Today (~85%) |
| ------- | ------------ |
| One-command start; documented first run; Docker Postgres; local file storage; console email; dev auth stub; mobile live reload | **Done:** `npm run dev`, `docker compose`, `db:schema`, seed scripts, Capacitor live reload (`adb:virtual`, `cap:live`), `.env` branding |

**Gap:** `.env.example` was removed (git status); new contributors lack a committed template. Optional: documented “clean machine” checklist and `db:reset` in README first-run.

**Next steps:** Restore `.env.example` with non-secret placeholders; document required vs optional keys.

---

### 2. Core domain & data model

| At 100% | Today (~70%) |
| ------- | ------------ |
| Normalized schema; migrations versioned; indexes for hot paths; retention/archive rules; audit history | **Done:** tasks, crew, contacts, addresses, attachments, documents, email log, task history, org config, custom fields, cancelled-task archive |
| | **Partial:** some indexes documented but not created; full status/type enum parity with licensed product not documented |
| | **Missing:** formal data retention/backup policy; migration rollback strategy |

**Next steps:** Close index gaps from [`database-design.md`](database-design.md); document status/type enums in [`task-model.md`](task-model.md); add backup/restore runbook when approaching production.

---

### 3. Core product — web (task creators)

| At 100% | Today (~60%) |
| ------- | ------------ |
| Task board with filters; create/edit/clone; assignment; scheduling; destination; contacts; custom fields; status workflow; attachments; PDF view; user/contact/address management; org settings; import/export; crew map | **Done:** TasksPage (all/mine), NewTaskModal, TaskDetailModal, Contacts, Addresses, Users, Management, CrewMap, bulk import, route optimize, required-field validation, org task types/icons |
| | **Partial:** task list performance at scale untested; some dev-only routes (`/dev/status-transitions`) |
| | **Missing:** licensed-product parity checklist; formal MVP field subset signed off |

**Next steps:** Define and tick off MVP parity list against licensed exports; remove or gate dev-only pages from production builds.

---

### 4. Core product — mobile (crew)

| At 100% | Today (~50%) |
| ------- | ------------ |
| QR activation; durable session; remote revoke; assignment-scoped task list/detail; start/end crew events with GPS; photo capture; complete/fail flows; maps navigation; push on assign/schedule change | **Done:** QR activation, device sessions, revoke, my-tasks list, DeliverTaskPage, CompleteTaskPage, crew events, camera attachments, maps links, Android back handling |
| | **Partial:** notification **tap → deep link** plumbing exists; NotificationsPage is **local test buttons only** — no server-driven push |
| | **Missing:** FCM/APNs; assignment-scoped `GET /api/tasks/:id`; session-bound `uploaded_by_user_id`; offline behavior (if required) |

**Next steps:** Close mobile scoping gaps in SDD §7.3; decide push notification MVP (server events → FCM); test on physical iOS + Android for complete/fail/photo flows.

---

### 5. Critical features — PDF generation

| At 100% | Today (~55%) |
| ------- | ------------ |
| Shipping label, delivery docket, proof of completion; server-generated; stored per task; view/download web + mobile; triggers defined and tested | **Done:** delivery docket (`GET /api/tasks/:id/delivery-docket`), proof of completion (on demand + public URL), `task_documents` metadata, UI print |
| | **Missing:** shipping label PDF; automatic generation on status events (today is **on-demand only**); automated tests for `deliveryDocket.mjs` |

**Next steps:** Sample shipping label layout from operations; add tests for PDF output (buffer/hash or snapshot); decide trigger matrix per [`critical-features.md`](critical-features.md).

---

### 6. Critical features — automatic email

| At 100% | Today (~75%) |
| ------- | ------------ |
| Event-driven sends; templates; `email_deliveries` audit; idempotency; retry; SES production; `PUBLIC_APP_URL` for tracking links | **Done:** Completed/Failed triggers, type-specific templates, guards, console + SES providers, delivery log, `npm run email:test` |
| | **Partial:** retry is manual / re-status — no background retry job |
| | **Missing:** automated tests beyond `taskCompletionEmails` helpers; SES domain/DKIM runbook; assignment/schedule notification emails (out of current trigger scope) |

**Next steps:** Integration tests with mocked SES; document production email checklist; optional SQS/cron retry worker for `failed` rows.

---

### 7. Public / customer-facing

| At 100% | Today (~65%) |
| ------- | ------------ |
| Tokenized tracking page; tracking status; download POD; branded; no auth leak | **Done:** `TrackingPage`, `/t/:token`, customer document download |
| | **Partial:** branding via env; rate limiting / abuse protection not documented |
| | **Missing:** tracking page test coverage; SEO/robots policy (likely N/A) |

---

### 8. Security & authorization

| At 100% | Today (~50%) |
| ------- | ------------ |
| Web Entra SSO; mobile device sessions; permission keys enforced; **all** routes scoped correctly; secrets managed; input sanitization; rate limits; audit trail | **Done:** Entra + local stub, mobile activate/revoke, `manage_users` / `manage_org` / `view_crew_map`, status transition validation, DOMPurify on client HTML |
| | **Gaps (documented in SDD §7.3):** web users can hit unscoped task detail, attachments, delivery-docket; mobile can reach shared create/update routes; `uploaded_by_user_id` caller-declared |
| | **Missing:** rate limiting, CSRF strategy for cookie auth (if any), security review checklist, penetration test |

**Next steps:** Implement `taskAccess` middleware on all task-scoped routes; bind attachment uploader to session user; hash audit for activation codes; threat model doc.

---

### 9. Automated testing

| At 100% | Today (~25%) |
| ------- | ------------ |
| CI on every PR; lint + test; coverage thresholds; unit tests for business logic; integration tests for API; component tests for critical UI; E2E for golden paths; tests always green | **Done:** Vitest, 27 test files, strong coverage of `shared/*`, import parsing, status transitions, permissions, org settings drafts, some server modules with mocked DB |
| | **Missing:** React Testing Library; any `src/` tests; HTTP integration tests; E2E (Playwright); coverage reporting; CI; 12+ untested server modules (`deliveryDocket`, `attachments`, `index` routes, etc.) |

**What a peer app this size typically has:**

| Layer | Typical target | Field today |
| ----- | -------------- | ----------- |
| Pure functions (`shared/`) | 80%+ line coverage | ~Good (~70% of modules) |
| Server business logic | Critical paths mocked + some integration | ~Partial |
| API routes | Supertest or similar against test DB | None |
| React components | RTL for forms, modals, validation | None |
| E2E | 3–10 flows (login, create task, complete on mobile) | None |
| CI | Required green build | None |

**Next steps (ordered):**

1. Fix failing test; add GitHub Actions `npm test` + `npm run lint`.
2. Add `@vitest/coverage-v8`; set modest thresholds on `shared/` + `server/` (e.g. 60% lines, raise over time).
3. Server integration tests: task create, status PATCH, crew-events terminal email trigger (test DB or transaction rollback).
4. Install `@testing-library/react`; test `NewTaskModal` required-field validation and `requiredTaskFields` integration.
5. Playwright: one flow — web creates task → mobile completes → email logged.

---

### 10. CI/CD & environments

| At 100% | Today (~5%) |
| ------- | ----------- |
| PR checks (lint, test, build); staging auto-deploy; production promote; migration job; secrets in vault; rollback procedure | **Done:** `npm run build`, `npm test`, `npm run lint` scripts exist locally |
| | **Missing:** GitHub Actions; staging stack (removed); deploy scripts; environment promotion; database migration in deploy pipeline |

**Next steps:** Minimal workflow (`.github/workflows/ci.yml`); restore staging when AWS work begins; document promote process.

---

### 11. Production infrastructure (AWS)

| At 100% | Today (~10%) |
| ------- | ------------ |
| RDS Postgres; ECS/Fargate or equivalent API; S3 static web + files; CloudFront; SES; secrets manager; IaC; health checks; TLS | **Done:** provider abstractions in `server/storage.mjs`, `server/email.mjs`; S3/SES SDK deps; health endpoint |
| | **Missing:** all provisioned resources; IaC (CDK stack deleted); `PUBLIC_APP_URL` production value; CORS, WAF, autoscaling |

**Next steps:** User-directed AWS pass per [`sdd.md`](sdd.md) §2.3; single-environment checklist before multi-env.

---

### 12. Observability & operations

| At 100% | Today (~5%) |
| ------- | ----------- |
| Structured logs; request IDs; error tracking (Sentry); metrics (latency, 5xx); alerts; on-call runbooks; backup/restore tested | **Done:** console email provider logs; `email_deliveries` table; task history |
| | **Missing:** everything else |

**Next steps:** Structured JSON logging in API; Sentry (or equivalent); RDS automated backups; runbooks: “email stuck failed”, “restore DB”, “revoke compromised device”.

---

### 13. Mobile build & distribution

| At 100% | Today (~40%) |
| ------- | ------------ |
| Signed release APK/IPA; internal MDM/sideload process; version numbering; crash reporting; push certificates; store **not** required (private distribution) | **Done:** Capacitor 7, Android keystore script, `apk:serve`, iOS quickstart, QR activation |
| | **Partial:** release signing documented once; no crash analytics |
| | **Missing:** formal MDM doc; push cert provisioning; automated native build pipeline |

---

### 14. Code quality & maintainability

| At 100% | Today (~55%) |
| ------- | ------------ |
| Consistent patterns; lint in CI; strict TypeScript where valuable; no dead code; monolith boundaries clear; AGENTS.md accurate | **Done:** oxlint, TypeScript, shared modules, greenfield-no-legacy rule, UI width conventions |
| | **Partial:** large `server/index.mjs`; duplicate path entries in git (forward vs backslash) suggest merge noise |
| | **Missing:** lint gate in CI; route modularization; API client contract tests |

---

### 15. Documentation

| At 100% | Today (~60%) |
| ------- | ------------ |
| SDD, schema, critical features, email triggers, PDF layout, onboarding, API reference, ops runbooks, parity matrix | **Done:** SDD, database-design, task-model, critical-features, email-triggers, pdf-delivery-docket, import-google-sheets, ios-quickstart, AGENTS.md |
| | **Missing:** OpenAPI or route table maintained alongside code; production deploy runbook; testing strategy doc; licensed-product parity checklist |

---

### 16. Licensed-product parity

| At 100% | Today (~?) |
| ------- | ---------- |
| Feature matrix vs licensed FWM; gaps prioritized; UAT sign-off | **Unknown** — reference vendor unnamed; one task export in task-model; parity is informal |

**Next steps:** Build a parity spreadsheet (feature × licensed × Field × priority); drive roadmap phases from it.

---

## Phased roadmap (basics → 100%)

Phases are sequential in priority but can overlap. Percentages are **cumulative maturity toward production-grade**, not calendar estimates.

### Phase 0 — Basics that should exist now (~40% → ~45%)

**Goal:** Stop regressions; make quality visible.

| Item | Status |
| ---- | ------ |
| Fix failing Vitest test | ✅ |
| GitHub Actions: `npm test` + `npm run lint` + `npm run build` | ✅ |
| Restore `.env.example` | ✅ |
| README matches reality (Testing Library or remove claim) | ✅ |

**Exit criteria:** Every PR must pass CI; `main` is always green.

---

### Phase 1 — MVP hardening (~45% → ~55%)

**Goal:** Safe enough for a **trusted internal pilot** on local/staging data.

| Item | Status |
| ---- | ------ |
| Close SDD §7.3 authorization gaps (task detail, attachments, PDFs, mobile create denial) | ❌ |
| `taskAccess` middleware on all `/api/tasks/:id/*` routes | ❌ |
| Session-bound attachment uploader | ❌ |
| Tests: `deliveryDocket.mjs`, `taskCompletionEmails` integration, `createTask` beyond status flow | ❌ |
| Define MVP parity checklist vs licensed product | ❌ |
| Manual UAT script: create → assign → mobile execute → complete → email + POD | ❌ |

**Exit criteria:** No known “any authenticated user can read any task” holes; pilot script passes twice on clean DB.

---

### Phase 2 — Test depth (~55% → ~65%)

**Goal:** Refactor and ship features without fear.

| Item | Status |
| ---- | ------ |
| Coverage reporting + thresholds on `shared/` and `server/` | ❌ |
| API integration test suite (test Postgres) | ❌ |
| `@testing-library/react` tests for NewTaskModal, TaskDetailModal validation, Management settings save | ❌ |
| Playwright E2E: web create task + mobile complete (or mocked mobile API) | ❌ |

**Exit criteria:** ≥60% line coverage on `shared/`; ≥3 E2E tests green in CI; critical server modules have tests.

---

### Phase 3 — Staging & AWS (~65% → ~75%)

**Goal:** Run Field in a real cloud environment.

| Item | Status |
| ---- | ------ |
| Provision RDS, S3, SES, API hosting, static web (user-directed) | ❌ |
| Staging environment with seeded data | ❌ |
| `PUBLIC_APP_URL`, `EMAIL_FROM`, domain verification | ❌ |
| Deploy pipeline (migrate + deploy API + upload web) | ❌ |
| Smoke test against staging after deploy | ❌ |
| Provision **Alpha Industries** assurance org (separate DB/deploy) | ❌ |
| Alpha full-extent org config + random event simulator | ❌ |

**Exit criteria:** Staging URL usable by pilot users; emails deliver to real inboxes; PDFs in S3. Alpha Industries running independently for stability assurance — see [`official-orgs.md`](official-orgs.md).

**Alpha Industries:** Deferred until this phase. Sandbocks remains the local dev org; Alpha is a separate deployment with rich config and an automated simulator — not provisioned on Docker Postgres. Design: [`official-orgs.md`](official-orgs.md).

---

### Phase 4 — Production readiness (~75% → ~90%)

**Goal:** Operate Field like a real product.

| Item | Status |
| ---- | ------ |
| Structured logging + error tracking | ❌ |
| RDS backups + tested restore | ❌ |
| Email retry for `failed` deliveries | ❌ |
| Rate limiting on public routes | ❌ |
| Runbooks (deploy, rollback, incident) | ❌ |
| Security review / pen test on auth + public token | ❌ |
| Signed mobile builds + MDM/sideload doc | ❌ |

**Exit criteria:** On-call can diagnose a failed email and restore DB from backup without author help.

---

### Phase 5 — 100% (parity & polish) (~90% → ~100%)

**Goal:** Licensed replacement on agreed scope.

| Item | Status |
| ---- | ------ |
| Shipping label PDF (if in parity scope) | ❌ |
| Server-driven push notifications (assign, schedule change, cancel) | ❌ |
| Event-driven PDF generation (if operations require — vs on-demand) | ❌ |
| Licensed-product parity matrix ≥ agreed threshold | ❌ |
| Performance test on task list (target row count from operations) | ❌ |
| Accessibility pass on crew-critical flows | ❌ |
| UAT sign-off from operations | ❌ |

**Exit criteria:** Parity matrix signed off; production stable 30 days; no P0 security or data-scoping bugs open.

---

## Visual: maturity by pillar

```text
Local dev          ████████████████████░░  85%
Documentation      ███████████████░░░░░░░  60%
Email pipeline     ███████████████░░░░░░░  75%
Web product        █████████████░░░░░░░░░  60%
Tracking           █████████████░░░░░░░░░  65%
PDF pipeline       ███████████░░░░░░░░░░  55%
Security           ██████████░░░░░░░░░░░  50%
Data model         ██████████████░░░░░░░  70%
Mobile product     ██████████░░░░░░░░░░░  50%
Mobile distribution████████░░░░░░░░░░░░  40%
Code quality       ███████████░░░░░░░░░░  55%
Testing            █████░░░░░░░░░░░░░░░░  25%
CI/CD              █░░░░░░░░░░░░░░░░░░░   5%
Observability      █░░░░░░░░░░░░░░░░░░░   5%
Production AWS     ██░░░░░░░░░░░░░░░░░░  10%
Licensed parity    ?░░░░░░░░░░░░░░░░░░░   ?
                   ─────────────────────
Overall (~weighted)████░░░░░░░░░░░░░░░░  ~40%
```

---

## What to work on first

If the goal is **maximum risk reduction per hour**:

1. **Phase 0** — CI + fix red test (prevents silent regressions).
2. **Phase 1** — Authorization gaps (prevents data leaks in any shared environment).
3. **Phase 2** — Tests on PDF, email, and task create (protects critical features).
4. **Parity matrix** — Stops building the wrong remaining 60%.

If the goal is **demo to stakeholders**:

1. Manual UAT script on local dev with seed data.
2. Staging deploy (Phase 3) with real SES.
3. Mobile complete flow on physical device.

---

## Maintaining this document

Update this roadmap when:

- A phase exit criterion is met (check the box, bump percentages).
- MVP scope or licensed parity list changes.
- Production infrastructure is provisioned.
- Test count / CI status changes materially.

Keep percentages honest — round to nearest 5% and note assumptions in the pillar section.
