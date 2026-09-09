-- Phase C: org-configured custom field values on tasks.
-- JSONB keyed by slot ("1".."5"). Grid filtering is out of scope; a normalized
-- table can wait until columns need to be queried.
-- Date values are date-only (YYYY-MM-DD). Lookups store the catalog entity id.
-- crew_size / estimated_hours stay nullable for a follow-up drop.

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO org_custom_field_defs (slot, label, data_type, required, lookup_table)
SELECT 1, 'Crew size', 'number', false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM org_custom_field_defs
  WHERE lower(label) IN ('crew size', 'guys')
)
AND NOT EXISTS (SELECT 1 FROM org_custom_field_defs WHERE slot = 1);

INSERT INTO org_custom_field_defs (slot, label, data_type, required, lookup_table)
SELECT 2, 'Estimated hours', 'number', false, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM org_custom_field_defs
  WHERE lower(label) IN ('estimated hours', 'hours')
)
AND NOT EXISTS (SELECT 1 FROM org_custom_field_defs WHERE slot = 2);

UPDATE tasks t
SET custom_fields = jsonb_strip_nulls(
  COALESCE(t.custom_fields, '{}'::jsonb)
  || COALESCE(
       (
         SELECT jsonb_build_object(d.slot::text, to_jsonb(t.crew_size))
         FROM org_custom_field_defs d
         WHERE lower(d.label) IN ('crew size', 'guys')
           AND t.crew_size IS NOT NULL
         ORDER BY d.slot
         LIMIT 1
       ),
       '{}'::jsonb
     )
  || COALESCE(
       (
         SELECT jsonb_build_object(d.slot::text, to_jsonb(t.estimated_hours))
         FROM org_custom_field_defs d
         WHERE lower(d.label) IN ('estimated hours', 'hours')
           AND t.estimated_hours IS NOT NULL
         ORDER BY d.slot
         LIMIT 1
       ),
       '{}'::jsonb
     )
)
WHERE COALESCE(t.custom_fields, '{}'::jsonb) = '{}'::jsonb
  AND (t.crew_size IS NOT NULL OR t.estimated_hours IS NOT NULL);

COMMIT;
