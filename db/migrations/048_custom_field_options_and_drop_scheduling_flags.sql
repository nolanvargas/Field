-- Select/multiselect options on org custom field defs.
-- Migrate legacy is_time_specific / can_start_early / is_urgent into custom_fields; drop columns.

BEGIN;

ALTER TABLE org_custom_field_defs
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO org_custom_field_defs (slot, label, data_type, required, lookup_table, options)
SELECT 3, 'Can start early', 'boolean', false, NULL, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM org_custom_field_defs WHERE slot = 3)
  AND NOT EXISTS (
    SELECT 1 FROM org_custom_field_defs WHERE lower(trim(label)) = 'can start early'
  );

INSERT INTO org_custom_field_defs (slot, label, data_type, required, lookup_table, options)
SELECT 4, 'Time specific', 'boolean', false, NULL, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM org_custom_field_defs WHERE slot = 4)
  AND NOT EXISTS (
    SELECT 1 FROM org_custom_field_defs WHERE lower(trim(label)) = 'time specific'
  );

INSERT INTO org_custom_field_defs (slot, label, data_type, required, lookup_table, options)
SELECT 5, 'Urgent', 'boolean', false, NULL, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM org_custom_field_defs WHERE slot = 5)
  AND NOT EXISTS (
    SELECT 1 FROM org_custom_field_defs WHERE lower(trim(label)) = 'urgent'
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'can_start_early'
  ) THEN
    UPDATE tasks t
    SET custom_fields = jsonb_strip_nulls(
      COALESCE(t.custom_fields, '{}'::jsonb)
      || COALESCE(
           (
             SELECT jsonb_build_object(d.slot::text, to_jsonb(t.can_start_early))
             FROM org_custom_field_defs d
             WHERE lower(trim(d.label)) = 'can start early'
               AND t.can_start_early = true
             ORDER BY d.slot
             LIMIT 1
           ),
           '{}'::jsonb
         )
      || COALESCE(
           (
             SELECT jsonb_build_object(d.slot::text, to_jsonb(t.is_time_specific))
             FROM org_custom_field_defs d
             WHERE lower(trim(d.label)) = 'time specific'
               AND t.is_time_specific = true
             ORDER BY d.slot
             LIMIT 1
           ),
           '{}'::jsonb
         )
      || COALESCE(
           (
             SELECT jsonb_build_object(d.slot::text, to_jsonb(t.is_urgent))
             FROM org_custom_field_defs d
             WHERE lower(trim(d.label)) = 'urgent'
               AND t.is_urgent = true
             ORDER BY d.slot
             LIMIT 1
           ),
           '{}'::jsonb
         )
    )
    WHERE t.can_start_early = true
       OR t.is_time_specific = true
       OR t.is_urgent = true;
  END IF;
END $$;

ALTER TABLE tasks DROP COLUMN IF EXISTS is_time_specific;
ALTER TABLE tasks DROP COLUMN IF EXISTS can_start_early;
ALTER TABLE tasks DROP COLUMN IF EXISTS is_urgent;

COMMIT;
