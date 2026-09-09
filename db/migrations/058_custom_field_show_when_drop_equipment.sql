-- Equipment is a tenant custom field, not a built-in catalog.
-- Task custom fields may limit visibility to named task types (show_when).

BEGIN;

ALTER TABLE tasks DROP COLUMN IF EXISTS equipment_option_ids;
ALTER TABLE archived_tasks DROP COLUMN IF EXISTS equipment_option_ids;

DROP TABLE IF EXISTS org_equipment_options;

ALTER TABLE org_task_types DROP COLUMN IF EXISTS shows_equipment;

ALTER TABLE org_custom_field_defs
  ADD COLUMN IF NOT EXISTS show_when jsonb;

COMMIT;
