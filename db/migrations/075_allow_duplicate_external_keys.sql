-- Orgs may allow several live tasks to share an external key.
-- Default on so existing shared keys stay valid. Enforcement of new
-- collisions is in the task write path, not a unique index.

BEGIN;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS allow_duplicate_external_keys boolean NOT NULL DEFAULT true;

COMMIT;
