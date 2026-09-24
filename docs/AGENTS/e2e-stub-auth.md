# E2E smoke: stub auth (no FIELD_API_REQUIRE_AUTH)

Playwright smoke (`npm run test:e2e`) starts [`scripts/e2e-serve.mjs`](../../scripts/e2e-serve.mjs), which **deletes** `FIELD_API_REQUIRE_AUTH` from the child process env even if the shell inherited it.

**Why:** With `FIELD_API_REQUIRE_AUTH=1`, the web stub user picker does not attach Bearer tokens — only integration tests use `test-user:<userId>` tokens via `authFetch`. Open stub auth matches default local `npm run dev`.

**What E2E proves:** Vite on `:5173` proxies `/api` to `:3000`, Postgres-backed `/api/users` and org settings load, coordinator task board renders (`e2e/tasks-board.smoke.spec.ts` sets `field.currentUserId` to Logan Reed in `localStorage`).

**What stays elsewhere:**

- Bearer auth and scoping → `tests/integration/*.api.test.ts`
- Pilot UAT with `FIELD_API_REQUIRE_AUTH=1` → [`docs/pilot-uat-script.md`](../pilot-uat-script.md) (manual)
- Entra / mobile QR → manual domains **A**, **M**

CI runs E2E after integration; Logan Reed (same UUID as Sandbocks seed) is upserted by integration fixtures — no separate `db:seed-dev-data` step required on an empty CI database.
