-- Drop deprecated columns superseded by tasks.custom_fields (migration 040).

BEGIN;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS crew_size,
  DROP COLUMN IF EXISTS estimated_hours;

ALTER TABLE archived_tasks
  DROP COLUMN IF EXISTS crew_size,
  DROP COLUMN IF EXISTS estimated_hours;

COMMIT;
