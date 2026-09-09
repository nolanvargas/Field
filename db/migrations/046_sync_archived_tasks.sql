-- Keep archived_tasks in sync with tasks after non-retroactive config (044/045).

BEGIN;

ALTER TABLE archived_tasks
  ADD COLUMN IF NOT EXISTS archive_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS task_type_id int NULL,
  ADD COLUMN IF NOT EXISTS equipment_option_ids bigint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_field_defs_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE archived_tasks
  DROP COLUMN IF EXISTS equipment;

COMMIT;
