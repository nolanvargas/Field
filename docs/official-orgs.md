# Official organizations

Field uses two officially designated organizations. Each is a **separate single-tenant deployment** (own database and environment variables) — not multi-tenant coexistence in one database.

Canonical names live in [`shared/officialOrgs.js`](../shared/officialOrgs.js).

---

## Sandbocks (development)

| | |
|---|---|
| **Role** | Local development and manual testing |
| **Active** | Now |
| **Branding** | `COMPANY_NAME=Sandbocks` in `.env` (see [`.env.example`](../.env.example)) |
| **Org config** | Product defaults from [`scripts/lib/org-config-defaults.mjs`](../scripts/lib/org-config-defaults.mjs) |
| **Data** | Fictional Las Vegas seed users, venues, contacts, and tasks |
| **Lifecycle** | Disposable — `npm run db:reset` wipes and re-seeds everything, including org catalog defaults |

Sandbocks is the org developers mutate freely. Management experiments, import tests, and manual UAT all run here. A reset returns Sandbocks to a known baseline.

**First run:**

```bash
cp .env.example .env
docker compose up -d
npm run db:schema
npm run db:reset
npm run dev
```

---

## Alpha Industries (assurance)

| | |
|---|---|
| **Role** | Independent assurance org — exercises the full product surface for operating stability |
| **Active** | After deployed infrastructure exists (not local-only) |
| **Branding** | `COMPANY_NAME=Alpha Industries` in that deployment's `.env` |
| **Org config** | Rich, non-default configuration (see checklist below) |
| **Data** | Own fictional catalog; mutated by an automated random-event simulator |
| **Lifecycle** | Persistent — never touched by Sandbocks `db:reset` or local dev workflows |

Alpha Industries provides an extra layer of testing beyond unit tests and manual Sandbocks sessions. Long-term, a background worker performs weighted random actions (create tasks, assign crew, status transitions, crew GPS events, attachments, PDFs, emails, cancel/restore/archive) at a controlled rate to surface regressions in a live environment.

**Not provisioned locally.** There is no operating stability to assure until Field runs on persistent hosted infrastructure. Provisioning begins when Phase 3 (staging/AWS) exit criteria are met — see [`roadmap.md`](roadmap.md).

Scaffold and deferred entry point: [`scripts/alpha-industries/README.md`](../scripts/alpha-industries/README.md).

### Provisioning gate

Alpha becomes operational when at minimum:

- Persistent hosted API + database (not Docker-on-laptop)
- Console email replaced with a real provider (SES) or a dedicated test sink
- File storage that survives redeploys (S3 or equivalent)
- `PUBLIC_APP_URL` set for customer tracking links

### Full-extent config checklist

Applied once at provision time (non-default vs Sandbocks):

- Custom task types beyond defaults (or renamed/disabled types)
- Entity and task custom fields with `show_when` and required flags
- `required_task_fields` populated
- Non-default accent color, cancel retention, and external key label
- Print templates seeded for all document types
- Public and tracking page templates configured
- Web auth provider configured (if testing SSO path)

### Automated simulator (future)

Not built yet. Target design:

- Cron or worker against Alpha's API
- Weighted random actions across the task lifecycle
- Rate-limited, idempotent-friendly, with an audit log
- Distinct fictional users, contacts, and addresses (not Sandbocks Vegas seed)

---

## Independence rules

1. **Sandbocks resets never affect Alpha** — separate database and deployment.
2. **Alpha is not a dev sandbox** — changes are driven by the simulator and deliberate assurance work, not feature development.
3. **No multi-tenancy code** until a product requirement demands it; two deployments are sufficient for now.

---

## Related documents

| Document | Relevance |
| -------- | --------- |
| [`manual-test-overview.md`](manual-test-overview.md) | Manual UAT runs against Sandbocks |
| [`sdd.md`](sdd.md) §2.3 | Development environment |
| [`roadmap.md`](roadmap.md) Phase 3 | Infra gate before Alpha provisioning |
