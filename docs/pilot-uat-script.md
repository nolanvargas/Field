# Pilot UAT script

Repeatable **trusted internal pilot** check on a **clean database**. Run **twice** before calling Phase 1 exit criteria met (issue #7 — second pass is **Run C** below; issue #15 covers auth hardening / Run B).

**Environment**

1. `docker compose up -d`
2. `npm run db:schema` then `npm run db:reset` (Sandbocks seed) — or `db:reset` alone if schema already applied
3. Set in `.env` for this run:
   - `FIELD_API_REQUIRE_AUTH=1` (matches shared/staging API — **required** for authorization checks)
   - `EMAIL_PROVIDER=console`
   - `PUBLIC_APP_URL=http://localhost:5173` (tracking links in email)
4. `npm run dev` — web `:5173`, API `:3000` (restart after `db:reset` so org-settings cache matches the DB)

**Users (seed):** Logan Reed (coordinator, all permissions), Alex Rivera (crew).

---

## Run A — web coordinator + mobile crew

| Step | Actor | Action | Pass criteria |
| ---- | ----- | ------ | ------------- |
| 1 | Logan | Web login (local picker → Logan) | Tasks board loads |
| 2 | Logan | Create **Delivery** task: destination, one contact with email (receives email on), assign **Alex** as lead, external key `uat-pilot-1` | Task appears **Assigned** |
| 3 | Logan | Open task → **Print** → Delivery docket | PDF opens; no error |
| 4 | Logan | Users → issue mobile activation QR for **Alex** | Code displayed |
| 5 | Alex | Mobile (or More → activate): scan/paste QR | My tasks shows new task |
| 6 | Alex | Open task → **Start** (crew event) | Status **In Progress** |
| 7 | Alex | Add photo attachment | Photo listed; uploader = Alex |
| 8 | Alex | **Complete** task (notes optional) | Status **Completed** |
| 9 | Logan | API terminal / Mailpit: confirm completion email logged | `email_deliveries` row **sent** or **failed** with reason; console shows HTML |
| 10 | Logan | Task → **Proof of completion** print | PDF opens |
| 11 | Logan | Open tracking link from email or task | Customer page loads; POD/docket links work |

---

## Run B — authorization smoke (same DB after Run A, or fresh reset)

| Step | Actor | Action | Pass criteria |
| ---- | ----- | ------ | ------------- |
| 1 | Alex | Web login as Alex (crew user) | |
| 2 | Alex | Attempt to open a task **not** assigned to Alex (pick from seed, e.g. another crew’s task) | **403** or task not listed |
| 3 | Alex | Mobile session: `POST /api/tasks` (e.g. via devtools) | **403** Mobile sessions cannot create tasks |
| 4 | Logan | Can still see all tasks (`view_all_tasks`) | Full board |

---

## Run C — clean DB repeat (GitHub issue #7 “A-2”)

1. `npm run db:reset`
2. Repeat **Run A** only with external key `uat-pilot-2`
3. Both runs must pass without manual DB fixes

Optional: `node scripts/run-pilot-uat.mjs uat-pilot-1` then `npm run db:reset` and `node scripts/run-pilot-uat.mjs uat-pilot-2` against `npm run dev` with `FIELD_API_REQUIRE_AUTH=1`.

---

## Failure log

| Date | Step | Symptom | Issue # |
| ---- | ---- | ------- | ------- |
| | | | |
