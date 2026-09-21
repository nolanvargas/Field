# MVP scope checklist

Working checklist for **minimum pilot scope** — not a signed contract. Tick when behavior is verified (automated test and/or [`pilot-uat-script.md`](pilot-uat-script.md)).

**Legend:** ✅ done · ⚠️ partial · ❌ not in scope / not started

## Core task lifecycle

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Create task (web) | P0 | ✅ | Types, desc, destination, contacts, crew, schedule fields |
| Assign crew (create/update) | P0 | ✅ | Lead + subs via `task_crew_members` |
| Task list + filters (web) | P0 | ✅ | Delivery / my tasks; permission-scoped lists |
| Task detail + status (web) | P0 | ✅ | Manual status transitions per `shared/statusTransitions.js` |
| Crew task list (mobile) | P0 | ✅ | QR activation + scoped `/api/tasks` |
| Crew execute: start / complete (mobile) | P0 | ✅ | Crew events + terminal status |
| Task history (web) | P1 | ✅ | Audit timeline on detail |
| Cancel + restore window | P1 | ✅ | Creator / `view_all_tasks` rules |

## Critical features (required)

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Delivery docket PDF | P0 | ✅ | `POST /api/print/delivery_docket` |
| Proof of completion PDF | P0 | ✅ | Print template + tracking download |
| Shipping label PDF | P2 | ❌ | Type exists; layout/trigger TBD |
| Auto email on Completed / Failed | P0 | ✅ | Console/SES via `email_deliveries` |
| Customer tracking page | P0 | ✅ | `/t/:token` + document links |

## Auth & safety (pilot)

| Feature | Priority | Status | Notes |
| ------- | -------- | ------ | ----- |
| Web login (Entra or local stub) | P0 | ✅ | |
| Mobile QR + device session | P0 | ✅ | Revoke from Users |
| Task API authorization (`taskAccess`) | P0 | ✅ | Requires auth on shared servers |
| Session-bound attachment uploader | P0 | ✅ | |

## Explicitly deferred (not MVP unless promoted)

| Item | Notes |
| ---- | ----- |
| Push notifications (production FCM/APNs) | Local test buttons only |
| AWS hosting / Alpha Industries deploy | tracked as deploy work (see issue #10 and the board) |
| Playwright E2E in CI | Phase 2 |
| Offline-first mobile | Capacitor web bundle only |
| Payroll / CRM integrations | — |

## Sign-off

| Role | Date | Notes |
| ---- | ---- | ----- |
| Product / operations | | |
| Engineering | | Pilot UAT ×2 on clean DB |
