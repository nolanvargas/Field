# Field — Agent Context

Quick orientation for AI agents working on this project.

## What This Is

**Field** is a field workforce management (FWM) application. It is being built to mirror the capabilities of a third-party FWM product the organization currently licenses, with the long-term goal of becoming a full replacement for that licensed solution.

This repository is greenfield. There is no existing codebase or formal requirements documentation yet.

## Core Concept: The Task

The **task** is the primary unit of the system. Everything else should support task creation and execution.

| Role              | Responsibility               |
| ----------------- | ---------------------------- |
| **Task creator**  | Creates and assigns tasks    |
| **Crew member**   | Performs and completes tasks |

Other entities (users, locations, schedules, etc.) may exist, but they exist in service of tasks. There are **no teams** — assignment is to individual **crew members** only. Field does **not** use the word "driver" (reference system may still say driver). When scoping features or data models, start from the task lifecycle: create → assign → execute → complete.

**Reference task shape:** A rough draft from the licensed system is documented in [`docs/task-model.md`](docs/task-model.md). Known examples: `TaskType` = `Delivery`, `Status` = `In Progress` (active work). Full status/type enums and transition rules are not yet documented.

## Critical Features

These are **required**, not nice-to-haves. Details in [`docs/critical-features.md`](docs/critical-features.md).

| Feature             | Scope                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **PDF generation**  | Shipping label, delivery docket, POD (proof of delivery) — server-generated, stored per task |
| **Automatic email** | Triggered by task events; sent to contact emails (and others TBD); logged for audit        |

When scoping MVP, include at least one PDF type and one email trigger end-to-end before considering the document/email pipeline complete. Do not treat these as post-MVP unless the user explicitly descopes.

| Aspect                       | Status                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Development phase            | **Build (started)** — web shell + Tasks page; see [`docs/sdd.md`](docs/sdd.md)                         |
| Core domain model            | **Task-centric** — draft schema in [`docs/task-model.md`](docs/task-model.md)                          |
| Primary platform             | **Web** (mobile-responsive from the start)                                                             |
| Frontend                     | **React + TypeScript**                                                                                 |
| Mobile clients               | **Capacitor** — shared private build; **QR activation** (see [Authentication](#authentication))        |
| Hosting (production target)  | **AWS** (deferred — architecture TBD)                                                                 |
| Development environment      | **Local app** — Docker Postgres, local file storage, console email                                   |
| Database (local / cloud-dev) | **PostgreSQL** — Docker Compose by default (see `.env`)                                        |
| Database (production target) | **RDS PostgreSQL** — see [`docs/database-design.md`](docs/database-design.md)                          |
| Backend / API                | **Node.js** (`server/index.mjs`) — local development                                                  |
| Auth                         | **Web:** pluggable identity providers per org (Entra is first module; local stub in dev). **Mobile:** QR activation + durable device session (remotely revocable). See [`docs/auth.md`](docs/auth.md). |
| MVP scope                    | **Not defined** (task field subset TBD)                                                                |
| Critical features            | **PDF generation**, **automatic email** — see [`docs/critical-features.md`](docs/critical-features.md) |

Many product details remain open. Treat undecided items as open until documented elsewhere in the repo.

## Platform & Clients

### Web-first (single codebase)

Field is built as a **React + TypeScript web application**. This is the lead platform for design and initial delivery.

Design **mobile-responsive UI from the start** — crew members will use the same UI on phones inside the Capacitor shell. The **web app requires login**; the **mobile app** uses **QR activation** (not Microsoft SSO).

### Mobile via Capacitor (decided)

Android and iOS apps are delivered by wrapping the **same built web app** in a native shell using **Capacitor**. This is not a separate mobile codebase or a one-click export.

**Distribution:** Mobile apps are **not published to public app stores**. Deploy internally only (e.g. enterprise MDM, sideload, or private org distribution). One **shared** private build for all crew (not one IPA/APK per person).

**Authentication:** Builds ship **deactivated**. The crew member scans a **QR code** (issued from the web app for their user) to activate. On success, the device stores a **durable session** so they stay signed in across launches. A user with `manage_users` can **revoke that device remotely**; the next API call fails and the app returns to the deactivated / scan-QR state. See [Authentication](#authentication).

**Workflow:**

1. Develop and test the React web app (including mobile viewport).
2. Production-build static assets (`dist/` or `build/`).
3. Sync into native projects with Capacitor (`npx cap sync`).
4. Build and distribute a **single shared** private IPA/APK via Xcode / Android Studio (MDM or sideload).
5. On device: scan activation QR → persist session → use crew task flows.

**Implications for agents:**

- One UI codebase for web, iOS, and Android — branch behavior on client context (web vs Capacitor), especially for auth gates.
- **Do not embed `userId` in the mobile build.** Do not use Microsoft SSO / Entra login on mobile.
- Mobile first screen when inactive: **QR scanner / activation**. When active: crew task UI with persisted session.
- Use Capacitor plugins when native device APIs are needed (camera/barcode for QR, push notifications, filesystem, etc.).
- Expect occasional mobile-specific tweaks (safe areas, keyboard, native permissions) — not a full rewrite.
- Offline-heavy requirements may stress this approach; flag tradeoffs if the user asks for robust offline-first behavior in MVP.

**Revisit React Native (Expo) only if:** offline-first becomes an MVP must-have, or native UX/background capabilities exceed what Capacitor reasonably supports.

## Authentication

| Client                 | Auth                                                                 | Users          |
| ---------------------- | -------------------------------------------------------------------- | -------------- |
| **Web**                | **Required** — login before access                                   | Task creators; extra keys for Users / Management / Crew map |
| **Mobile (Capacitor)** | **QR activation** — durable on-device session; remotely revocable     | Crew members   |

**Decided:**

- **Web:** **Multi-tenant identity sources** — each org configures its provider(s). Providers are modular (client login + API token verify + user upsert). **Microsoft Entra ID** is the first implemented module, not the only one. Local auth stub when no provider is configured (dev only).
- **Mobile:** Shared private build ships **deactivated** (no identity baked in).
- Crew activates by scanning a **valid QR** issued for their user from the web app.
- After activation, the app keeps a **permanent local session** (feels always signed in to the user).
- Access can be **pulled remotely** (revoke device/session server-side); subsequent requests are rejected and the app clears local auth and shows activation again.
- Do not use web SSO (Entra or any other provider), password login, or Cognito on the Capacitor build.
- `users.role` is a human label only. Extra access is `users.permissions` (`manage_users`, `manage_org`, `view_crew_map`). Do not gate on `role === 'admin'` or `role === 'crew'`.

Full auth design: [`docs/auth.md`](docs/auth.md).

**Implementation notes:**

- Detect Capacitor (`Capacitor.isNativePlatform()`). Web uses a configured identity provider's JWT (Entra today, or local stub); mobile uses device session token from QR activation.
- Persist mobile session in secure on-device storage (e.g. Capacitor Preferences / Secure Storage).
- Mobile API requests send the device session token; API resolves `userId`, scopes to `task_crew_members`, and sets audit fields.
- Reject revoked or unknown sessions with `401`; client wipes local state and returns to QR activation.
- Web users with `manage_users` can issue activation QRs and revoke mobile devices for a user.

## Tech Direction

### Frontend

- **React + TypeScript** for all client UI.
- **Capacitor** for iOS and Android — private internal distribution; QR activation (not Entra SSO).
- Capacitor 7 is scaffolded (`android/`, `ios/`). Day-to-day Android: `adb:virtual` / `adb:physical` with `npm run dev`; iOS: `cap:live -- ios`; bundled: `npm run cap:sync`. QR activation comes later.
- Structure routing so web-only routes (login, create task, task board) are gated; mobile crew routes require an active device session (or show QR activation when deactivated).

## Development environment

App, API, and services run on the developer machine by default. **No AWS resources are required** for local work.

| Concern      | Local (default)                                          | Cloud (future — not provisioned)                |
| ------------ | -------------------------------------------------------- | ----------------------------------------------- |
| Database     | PostgreSQL via **Docker Compose** (`docker compose up -d`) | Your PostgreSQL (RDS or other) when chosen      |
| API          | `localhost:3000` — Node (`server/index.mjs`)             | TBD when cloud hosting is chosen                |
| Web app      | Vite dev server `:5173`                                  | S3 + CloudFront or equivalent                   |
| File storage | `./storage/attachments` and `./storage/documents`      | S3 when `S3_BUCKET` is set                      |
| Web auth     | Local stub (user picker) or configured IdP module (Entra first) | Per-org identity source(s) — see [`docs/auth.md`](docs/auth.md) |
| Email        | **`EMAIL_PROVIDER=console`** (logs to terminal)          | Amazon SES when configured                      |
| PDF output   | Local `./storage/documents`                              | S3 (later)                                      |

**First run:** `docker compose up -d` → `npm run db:schema` → `npm run dev`. See [README.md](README.md).

**Official orgs:** Local dev is **Sandbocks** (defaults + seed data; `npm run db:reset`). **Alpha Industries** is a separate assurance deployment after infra exists — see [`docs/official-orgs.md`](docs/official-orgs.md).

**Branding:** `COMPANY_NAME`, `COMPANY_SUPPORT_EMAIL`, `EMAIL_FROM` in `.env`.

**Email pipeline:** [`server/email.mjs`](server/email.mjs) + [`server/emailDeliveries.mjs`](server/emailDeliveries.mjs) + [`server/taskCompletionEmails.mjs`](server/taskCompletionEmails.mjs). Smoke test: `npm run email:test`.

**Agent rules:**

- **Do not** run `aws` CLI deploys or create AWS resources unless the user explicitly requests it.
- **Do** use abstractions (storage provider, email provider, auth provider) so swapping to AWS later is straightforward.
- **Do** use Docker Compose for PostgreSQL for local dev.
- When AWS integration changes, update this section and [`docs/sdd.md`](docs/sdd.md) Section 11.

### Hosting & infrastructure (AWS — production target)

Production will run on **AWS**. Do not set this up until the user directs integration.

**Target AWS services** (for when integration happens):

| Concern            | Common AWS fit                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| API                | **ALB + ECS Fargate** or serverless when needed                  |
| Auth               | Pluggable web IdP per org (Entra module first); mobile uses QR-activated device sessions            |
| File uploads       | S3 with presigned URLs (task photos, attachments)                                                     |
| Database           | **RDS PostgreSQL** — schema in [`docs/database-design.md`](docs/database-design.md)                   |
| Static web hosting | **S3 + CloudFront** — custom domain when DNS is ready            |
| Push notifications | SNS, or FCM/APNs integration via Capacitor plugins                                                    |
| Email              | **Amazon SES** — automatic task emails (see [`docs/critical-features.md`](docs/critical-features.md)) |
| PDF storage        | **S3** — generated shipping labels, dockets, PODs                                                     |

Design code for AWS compatibility, but run locally until integration is requested.

### Backend

API is a **Node.js** HTTP server (`server/index.mjs`). Database is **PostgreSQL** — Docker Compose locally by default. Web auth: local stub in development, or a configured identity provider module (Entra today). See [Development environment](#development-environment) and [`docs/auth.md`](docs/auth.md).

## Guiding Principle: Minimum Viable Product First

The leading constraint for all work on this project:

> **Do not go overboard adding features.** Feature creep directly undermines the goal of shipping a minimum functioning product.

When making suggestions or implementing work:

1. **Prefer the smallest thing that works** — solve the immediate need, not hypothetical future needs.
2. **Defer nice-to-haves** — polish, edge cases, and "while we're here" additions belong after MVP.
3. **Mirror before innovate** — parity with the licensed product comes first; improvements come later.
4. **Question scope expansion** — if a request adds surface area, flag it and propose a narrower alternative.
5. **Document assumptions** — when requirements are unclear, state assumptions explicitly rather than inventing features.
6. **Task-first scoping** — ask whether a feature is essential to creating or executing a task before adding it.
7. **Critical features are in scope** — PDF generation (label, docket, POD) and automatic email are confirmed requirements; do not defer without user approval.

## What Agents Should Know

### Domain (high level)

Field workforce management covers work performed outside a central office. Model the domain around **tasks**. See [`docs/task-model.md`](docs/task-model.md) for the full draft field list.

**Task structure (summary):**

| Group      | Key fields                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| Identity   | `TaskType`, `Status`, `TaskDesc`, `ExternalKey`                             |
| Assignment | `AssignedToDriverUserId` → `task_crew_members` (`crewMemberIds[]`), contacts → `task_contacts` (`contactIds[]`), custom fields (`tasks.custom_fields`) |
| Scheduling | `AfterDateTime`, `BeforeDateTime`, `IsTimeSpecific`, `CanInstallEarly` → `can_start_early` |
| Locations  | `Destination*` → `tasks.destination_*` (catalog `addresses` prefills only) — no dispatch/pickup |
| Contacts   | `Recipient*` (reference) → `contacts` via `task_contacts` (`contactIds[]`); `TaskCreatedBy` |
| Completion | `CompletedNotes`, `CompletedDateTime`, `TaskFailedReason`                   |

**From the reference example:**

- `TaskDesc` holds rich crew instructions (directions, access codes, photo requirements).
- Tasks use **destination only** — Field does not model dispatch/pickup (single fixed origin).
- Contacts and destination are assigned separately (0..many contacts, 0..1 address).
- Each task has at most one **POC** (point of contact) among its contacts — typically the first contact added (`task_contacts.is_poc`).
- Per-contact `receives_email` controls automated task emails (POC defaults on; others default off).
- Each task has at most one **lead** among its crew members — typically the first crew member added (`task_crew_members.is_lead`); the rest are **sub**. Informational for now (same pattern as POC).
- Crew members are assigned by user ID; display names come from `users` (join), not stored on the task.
- Photo proof may be instruction-driven (described in `TaskDesc`) — attachment model TBD.

Do not implement every table or field for MVP. See [`docs/database-design.md`](docs/database-design.md) for the full schema and MVP subset. Work with the user to define the minimum slice for create → assign → execute → complete.

**Related tables (summary):** `users`, `addresses`, `contacts`, `tasks` (with `task_type` / `status` enums), `task_crew_members`, `task_crew_events` (per-crew start/end + GPS), `task_contacts`, `task_attachments`, `task_documents`, `email_deliveries`, `org_settings` / `org_task_types` / `org_custom_field_defs`.

### Reference system

There is an existing licensed FWM product that serves as the functional reference. Its name, vendor, and detailed feature set are not documented in this repo yet. When the user provides screenshots, exports, or feature lists from that system, treat those as the source of truth for parity discussions. The first task export is captured in [`docs/task-model.md`](docs/task-model.md).

### This repo

- **Project name:** Field
- **Workspace directory:** `field`
- **Contents:** Vite + React + TypeScript web app (DeliveryPage, CrewMapPage, TrackingPage; shared components in CloneTaskModal, PullToRefreshIndicator); docs under `docs/`.
- **Docs:** [`docs/sdd.md`](docs/sdd.md) (master design), `AGENTS.md`, `docs/task-model.md`, `docs/database-design.md`, `docs/critical-features.md`, [`docs/pdf-delivery-docket.md`](docs/pdf-delivery-docket.md).
- **Run locally:** `npm install && npm run dev` → http://localhost:5173 (API on `:3000`)
- **Tests:** Vitest — `npm test` / `npm run test:watch` (`*.test.ts(x)` under `tests/`)
- **Stop / restart dev servers:** `npm run dev:stop` frees ports 3000 + 5173; then `npm run dev` to start again. Prefer these over hunting PIDs.
- **Agent rule for servers:** Prefer one shared `npm run dev`. Before starting API/Vite, run `npm run dev:stop` (or rely on `npm run dev`, which frees those ports first). Do not leave orphan `node server/index.mjs` / `vite` processes; use `dev:stop` when done verifying.
- **Mobile (Capacitor):** Android `adb:virtual` / `adb:physical`; iOS `cap:live -- ios`; bundled `cap:sync` / `cap:android` / `cap:ios`; debug sideload `apk:serve` — see [`README.md`](README.md) Mobile section.
- **Email pipeline test:** `npm run email:test` → SES → `email_deliveries`
- **Import venues:** `npm run db:import-addresses` (CSV Name → `addresses.address_name`)
- **Import people contacts:** `npm run db:import-contacts` (people only — not the venue CSV)

## Recommended Agent Behavior by Phase

### Pre-design (complete)

Design artifacts consolidated in [`docs/sdd.md`](docs/sdd.md).

### Design (complete)

Master design in [`docs/sdd.md`](docs/sdd.md); proceed with MVP vertical slices.

### Build (current)

- React + TypeScript + Vite web app exists at repo root (`npm run dev`).
- Pages: DeliveryPage (task list with filters/status transitions), CrewMapPage (crew GPS map on desktop, `view_crew_map`), TrackingPage (customer tracking), TaskViewPage; shared components in CloneTaskModal, PullToRefreshIndicator.
- **Capacitor 7** scaffolding present (`android/`, `ios/`, `capacitor.config.ts`) — run `npm run cap:android` / `npm run cap:ios`. Mobile QR activation: desktop **Users** page issues `field1.` codes; More page scans them into a device session.
- Follow [`docs/sdd.md`](docs/sdd.md); implement MVP slices vertically.
- Do not add dependencies, modules, or abstractions without clear MVP justification.
- Build mobile-responsive web UI; Capacitor native projects are ready for local device/simulator testing.
- **Web:** local auth stub in development; configured identity provider when enabled (Entra module today) — JWT on API requests.
- **Mobile:** QR activation → durable device session; a user with `manage_users` can revoke devices remotely (API rejects revoked sessions; client returns to activation).
- Do not unify auth across clients — web uses provider JWTs; mobile uses QR-issued device sessions. Add new web providers as modules alongside Entra, not as Entra-specific branches.
- Do not provision AWS services without user approval. Local dev uses Docker Postgres + local storage + console email.

## Open Questions (to resolve with the user)

These are intentionally unanswered. Do not assume answers:

- What is the licensed product name/vendor?
- Full list of `TaskType` and `Status` values and allowed transitions?
- MVP field subset: which fields from [`docs/task-model.md`](docs/task-model.md) are required at create, assign, execute, complete?
- PDF/email triggers: which task events generate which document and send which email?
- Sample PDF layouts from licensed product (label, docket, POD)?
- One active mobile device per crew member vs multiple devices?
- AWS integration timing — user will specify when to move off local dev
- AWS backend shape (when integrating): serverless (Lambda) vs containerized (ECS)?
- Confirm status transitions and whether `contacts` master table is MVP-required
- Integrations (payroll, CRM, GPS, accounting, etc.)?
- Compliance, security, or industry constraints?
- Timeline and team size?

## Updating This File

Update `AGENTS.md` when any of the following change:

- Development phase moves forward (e.g., pre-design → design → build)
- Task model, MVP scope, or requirements are formally defined
- Architecture or backend/auth/database decisions are made
- Mobile strategy or hosting changes (currently Capacitor + AWS production target)
- The reference licensed product is identified and documented
- Core principles or constraints shift

Keep this file factual and scannable. Detailed specs belong in separate documents linked from here once they exist.
