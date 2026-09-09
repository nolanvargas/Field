-- Org-wide task list type filter removed; task type enabled flag is canonical.

BEGIN;

ALTER TABLE org_settings
  DROP COLUMN IF EXISTS default_task_type_filters;

COMMIT;
