-- Org-level required built-in task form fields (create/edit).
-- Custom field required flags remain on org_custom_field_defs.

BEGIN;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS required_task_fields text[] NOT NULL DEFAULT '{}';

COMMIT;
