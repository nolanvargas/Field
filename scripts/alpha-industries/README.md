# Alpha Industries (deferred)

**Alpha Industries** is Field's official assurance organization. It is provisioned only after deployed infrastructure exists — not on local Docker Postgres.

Full design: [`docs/official-orgs.md`](../../docs/official-orgs.md).

## Status

| Item | Status |
| ---- | ------ |
| Official designation | Done |
| Local provisioning | **Deferred** — no persistent infra to assure |
| Rich org config seed | Not started |
| Random event simulator | Not started |

## When ready

After Phase 3 staging/AWS is live:

1. Create a separate deployment (own database, `.env`, hostname).
2. Set `COMPANY_NAME=Alpha Industries`.
3. Apply the full-extent config checklist in `docs/official-orgs.md`.
4. Seed a distinct fictional catalog (not Sandbocks Vegas data).
5. Deploy the automated simulator worker.

## Stub

```bash
node scripts/alpha-industries/provision.mjs
```

Prints the provisioning gate and exits without writing to any database.
