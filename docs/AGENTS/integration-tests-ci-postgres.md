# Integration tests: CI vs local Postgres port

GitHub Actions CI sets `PGPORT=5432` (service container). Local Docker Compose maps Postgres to host **5433** (`docker-compose.yml`).

`scripts/lib/db-config.mjs` defaults to `localhost:5433` when `PGPORT` is unset — no `.env` change needed for local `npm run test:integration`.

CI workflow applies `npm run db:schema` then `npm run test:integration` with `FIELD_API_REQUIRE_AUTH=1` (via `scripts/test-integration.mjs`). Unit job runs `npm run test:coverage` (thresholds in `vitest.coverage.config.ts`).
