# Manual test overview

Discovery map for Field. Domains are listed **easiest to hardest**. Pick **one domain per session**, run its file in [`docs/manual-test/`](manual-test/), then check it off here.

**Automated layers:** when to write Vitest unit vs integration tests instead of (or in addition to) manual passes — [`testing-strategy.md`](testing-strategy.md).

**Progress:** check domains below as you complete them. Agents: mark `[x]` when the domain pass is done and note the date in **Completed**.

---

## Progress tracker

| Done | ID | Domain | File |
|:----:|:---:|--------|------|
| - [ ] | A | Shell & navigation | [a-shell-navigation.md](manual-test/a-shell-navigation.md) |
| - [ ] | B | All Tasks board | [b-all-tasks-board.md](manual-test/b-all-tasks-board.md) |
| - [ ] | C | Task detail modal | [c-task-detail-modal.md](manual-test/c-task-detail-modal.md) |
| - [ ] | D | My Tasks (crew list) | [d-my-tasks.md](manual-test/d-my-tasks.md) |
| - [ ] | E | Tracking | [e-tracking.md](manual-test/e-tracking.md) |
| - [ ] | F | Auth & permissions | [f-auth-permissions.md](manual-test/f-auth-permissions.md) |
| - [ ] | G | Contacts CRUD | [g-contacts-crud.md](manual-test/g-contacts-crud.md) |
| - [ ] | H | Addresses CRUD | [h-addresses-crud.md](manual-test/h-addresses-crud.md) |
| - [ ] | I | Task create & edit | [i-task-create-edit.md](manual-test/i-task-create-edit.md) |
| - [ ] | J | Attachments | [j-attachments.md](manual-test/j-attachments.md) |
| - [ ] | K | PDF & documents | [k-pdf-documents.md](manual-test/k-pdf-documents.md) |
| - [ ] | L | Status, cancel, restore, clone | [l-status-cancel-restore-clone.md](manual-test/l-status-cancel-restore-clone.md) |
| - [ ] | M | Users & devices | [m-users-devices.md](manual-test/m-users-devices.md) |
| - [ ] | N | Management — org config | [n-management-org-config.md](manual-test/n-management-org-config.md) |
| - [ ] | O | Import / export | [o-import-export.md](manual-test/o-import-export.md) |
| - [ ] | P | Crew map | [p-crew-map.md](manual-test/p-crew-map.md) |
| - [ ] | Q | Dev tools | [q-dev-tools.md](manual-test/q-dev-tools.md) |
| - [ ] | R | Mobile QR & session | [r-mobile-qr-session.md](manual-test/r-mobile-qr-session.md) |
| - [ ] | S | Crew task execution | [s-crew-task-execution.md](manual-test/s-crew-task-execution.md) |
| - [ ] | T | Archive / purge | [t-archive-purge.md](manual-test/t-archive-purge.md) |
| - [ ] | U | Email pipeline | [u-email-pipeline.md](manual-test/u-email-pipeline.md) |
| - [ ] | V | Route optimize (API only) | [v-route-optimize.md](manual-test/v-route-optimize.md) |

**Completed:** _none yet_

---

## Shared setup

Manual tests run against **Sandbocks**, the local development org ([`docs/official-orgs.md`](official-orgs.md)). Re-run `npm run db:reset` if a prior domain mutated org settings, users, or tasks — reset also restores org catalog defaults.

```bash
cp .env.example .env
# Recommended:
# PUBLIC_APP_URL=http://localhost:5173

docker compose up -d
npm run db:schema
npm run db:reset
npm run dev
```

| Item | Value |
|------|-------|
| Org | **Sandbocks** (`COMPANY_NAME` in `.env`) |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| Default acting user | **Logan Reed** — stub picker on **More** / **Settings** (`UserSelect`) — all permissions |
| Crew-only user | **Alex Rivera** — no admin nav |
| Email | `EMAIL_PROVIDER=console` → watch API terminal |

### Optional profiles

| Profile | When needed | Add to `.env` / commands |
|---------|-------------|--------------------------|
| Maps | Addresses Places/pin; route optimize API | `GOOGLE_MAPS_API_KEY` |
| Mobile | QR activation, crew execution | `npm run adb:virtual` or `adb:physical`; `VITE_API_BASE` on physical device |
| Entra SSO | Web login variant | `VITE_AZURE_*`, `AZURE_*` |
| Google Sheets | Import workbook links | `VITE_IMPORT_GOOGLE_SHEETS={...}` |

---

## Seed data quick reference

After `npm run db:reset`:

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 15 | 10 crew + 5 admins (all permissions) |
| Addresses | 18 | Las Vegas venues |
| Contacts | 8 | Fictional POCs |
| Tasks | 30 | #30 soft-deleted — must never appear in UI |

### Users

| Role | Name | Email |
|------|------|-------|
| Admin (default) | Logan Reed | logan.reed@example.com |
| Crew | Alex Rivera | alex.rivera@example.com |
| Admin alt | Nina Ortiz | nina.ortiz@example.com |

### Tasks (stable IDs)

Dates shift so Pacific **today** matches seed anchor; **#11** is always today, In Progress.

| ID | Type | Status | Use for |
|----|------|--------|---------|
| 1 | Delivery | Completed | Modal, docket PDF, public tracking, email history |
| 3 | Removal | Failed | Failed tab, failure email |
| 5, 29 | — | Cancelled | Cancelled tab |
| 6 | — | Undetermined | Undetermined tab |
| 11 | Delivery | In Progress | Crew execution, crew map, deliver flow |
| 13–14 | — | Assigned | Upcoming tab, status transitions |
| 19 | — | Unassigned | Create/compare, cancel/restore |
| 30 | — | Cancelled (deleted) | Must not appear anywhere |

**Note:** Some seeded attachment storage keys point at legacy S3 paths — downloads may 404 locally. Upload new files during tests for authoritative attachment checks.

---

## Domain files

Each domain is a checklist in [docs/manual-test/](manual-test/). Open the file from the progress tracker, run it, then mark the row done here.

## Suggested order

Work top to bottom. A few later domains still need an earlier one:

- **M** before **R** before **S** (issue a QR, activate, then execute)
- **P** can use seed GPS; a pass of **S** adds fresh markers
- **T**, **U**, and **V** need this machine (purge script, API terminal, or curl) and the env noted on the domain

---

## Expanding a domain file

The file for each domain already exists. To turn a short checklist into step-by-step steps, ask:

> Deep dive domain **P** — crew map

That expands `docs/manual-test/p-crew-map.md`. Do not add a second file for the same domain.

---

## Known limitations

- Seeded attachment downloads may 404 locally (legacy S3 keys).
- Route optimize has no UI (domain V is API-only).
- Entra SSO is a separate variant of domain F; not required for local stub testing.
- New Task button is desktop-only.
