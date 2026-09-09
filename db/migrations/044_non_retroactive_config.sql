-- Non-retroactive org config: frozen task type/equipment/custom-field defs on tasks,
-- archive_at on cancel, append-only catalog rows via retired_at.

BEGIN;

ALTER TABLE org_task_types
  ADD COLUMN IF NOT EXISTS retired_at timestamptz NULL;

ALTER TABLE org_equipment_options
  ADD COLUMN IF NOT EXISTS retired_at timestamptz NULL;

-- Slug unique only among active (non-retired) task types.
ALTER TABLE org_task_types DROP CONSTRAINT IF EXISTS org_task_types_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS org_task_types_slug_active_idx
  ON org_task_types (slug)
  WHERE retired_at IS NULL;

ALTER TABLE org_settings
  DROP COLUMN IF EXISTS external_key_regex;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS archive_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS task_type_id int NULL REFERENCES org_task_types (id),
  ADD COLUMN IF NOT EXISTS equipment_option_ids bigint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_field_defs_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS tasks_archive_at_idx
  ON tasks (archive_at)
  WHERE archive_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_task_type_id_idx ON tasks (task_type_id);

-- Backfill task_type_id from legacy task_type name (active catalog rows).
UPDATE tasks t
SET task_type_id = ott.id
FROM org_task_types ott
WHERE t.task_type_id IS NULL
  AND ott.retired_at IS NULL
  AND (ott.name = t.task_type OR ott.slug = t.task_type);

-- Backfill equipment_option_ids from legacy text[] labels.
UPDATE tasks t
SET equipment_option_ids = sub.ids
FROM (
  SELECT
    t2.id AS task_id,
    coalesce(
      array_agg(o.id ORDER BY o.sort_order, o.id) FILTER (WHERE o.id IS NOT NULL),
      '{}'::bigint[]
    ) AS ids
  FROM tasks t2
  LEFT JOIN LATERAL unnest(t2.equipment) AS lbl(label) ON true
  LEFT JOIN org_equipment_options o
    ON lower(o.label) = lower(lbl.label)
  WHERE coalesce(array_length(t2.equipment, 1), 0) > 0
  GROUP BY t2.id
) sub
WHERE t.id = sub.task_id;

-- Backfill custom field defs snapshot from current org defs.
UPDATE tasks t
SET custom_field_defs_snapshot = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'slot', d.slot,
        'label', d.label,
        'dataType', d.data_type,
        'required', d.required,
        'lookupTable', d.lookup_table
      )
      ORDER BY d.slot
    )
    FROM org_custom_field_defs d
    WHERE trim(d.label) <> ''
  ),
  '[]'::jsonb
)
WHERE t.custom_field_defs_snapshot = '[]'::jsonb;

-- Backfill archive_at for cancelled tasks using current org retention.
UPDATE tasks t
SET archive_at = t.cancelled_at + (os.cancel_retention_days * interval '1 day')
FROM org_settings os
WHERE os.id = 1
  AND t.status = 'Cancelled'
  AND t.cancelled_at IS NOT NULL
  AND t.archive_at IS NULL
  AND os.cancel_retention_days IS NOT NULL;

COMMIT;
