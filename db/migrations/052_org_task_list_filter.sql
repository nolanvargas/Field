-- Per-type plural label for task list page titles; org-wide default type filter.

BEGIN;

ALTER TABLE org_task_types
  ADD COLUMN IF NOT EXISTS plural_name varchar(100);

UPDATE org_task_types SET plural_name = CASE name
  WHEN 'Delivery' THEN 'Deliveries'
  WHEN 'Install' THEN 'Installs'
  WHEN 'Removal' THEN 'Removals'
  WHEN 'Site Survey' THEN 'Site Surveys'
  WHEN 'Pickup' THEN 'Pickups'
  WHEN 'Other' THEN 'Tasks'
  ELSE NULL
END
WHERE retired_at IS NULL AND plural_name IS NULL;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS default_task_type_filters text[] NOT NULL DEFAULT '{}';

COMMIT;
