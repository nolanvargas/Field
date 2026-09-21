# Curated attachment pool (fixtures)

- **10 logical types × 2 variants** → 20 binaries under `fixtures/curated/files/`; `manifest.json` keys are full SHA-256 `fileRef`s.
- **Catalog for task JSON:** `fixtures/curated/attachment-catalog.json` lists `id`, `kind`, `attachmentTypeSlug`, and per-variant `fileRef` / `fileName`.
- **Photo sources:** `fixtures/curated/sources/curated-{id}-v1.png` and `-v2.png` (separate scenes per variant). Output JPEGs are resized via Sharp only.
- **Regenerate:** `node scripts/generate-curated-attachment-pool.mjs` (replaces manifest + pool files on disk; does not touch `index.json` or task JSONs).
- **Sync after regen:** seed uses `syncCuratedFilesToStorage`; demo build uses `syncCuratedFilesToPublicDemo` from `scripts/lib/curatedTasks.mjs`.
- **Bulk-generated tasks** (dev seed filler + demo filler) pick storage keys via `shared/curatedAttachmentPool.mjs` (`pickCuratedAttachmentStorageKey` / `pickCuratedDemoAttachmentStorageKey`), not the tiny `attachments/seed/*` placeholders.
