# Curated task fixtures

Manual Sandbocks scenarios live under `fixtures/curated/` as versioned JSON plus a content-addressed file pool in `fixtures/curated/files/`.

**Capture:** shape a task in local dev → task detail overflow → **Save to curated fixtures** (`manage_org`, API off S3). Writes `fixtures/curated/tasks/{slug}.json` and dedupes binaries by SHA-256 in `files/manifest.json`.

**Timestamps:** each fixture stores `capturedAt` and `{ offsetMs }` fields; `db:reset` and demo boot materialize at `Date.now()` so relative times stay believable.

**Reseed:** `npm run db:reset` loads curated tasks first, then generated bulk until total 500 (`bulkCount = 500 - curatedCount`).

**Demo:** `buildBootTasks()` merges curated + generated to 100 tasks; `npm run build:demo` runs `scripts/sync-curated-demo-files.mjs` to copy binaries to `public/demo/curated/`. Demo boot resolves every `attachments[].fileRef` / `documents[].fileRef` through `fixtures/curated/files/manifest.json` — binaries only under `public/demo/curated/` (without manifest + `fixtures/curated/files/` copies) throw `Unknown curated file` at startup.

**Migrate legacy BASE_TASKS:** `node scripts/export-base-tasks-to-curated.mjs` (one-time).
