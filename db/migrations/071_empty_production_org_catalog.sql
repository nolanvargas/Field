-- Production ships an empty org catalog; Sandbocks dev restores via npm run db:reset-org-config.
-- See docs/official-orgs.md and docs/database-design.md.

BEGIN;

ALTER TABLE org_settings
  ALTER COLUMN accent_color DROP DEFAULT;

ALTER TABLE org_settings
  ALTER COLUMN accent_color DROP NOT NULL;

UPDATE org_settings
SET accent_color = NULL
WHERE id = 1;

UPDATE org_task_types
SET retired_at = now()
WHERE retired_at IS NULL;

DELETE FROM org_custom_field_defs;

DELETE FROM org_print_templates WHERE org_id = 1;

UPDATE org_settings
SET cancel_retention_days = NULL
WHERE id = 1;

COMMIT;
