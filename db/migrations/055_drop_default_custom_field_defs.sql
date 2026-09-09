-- Custom field defs are tenant-defined. Migration 048 seeded boolean slots for a
-- one-time column migration; the product ships with an empty custom-field catalog.

BEGIN;

DELETE FROM org_custom_field_defs
WHERE lower(trim(label)) IN ('can start early', 'time specific', 'urgent')
  AND data_type = 'boolean';

COMMIT;
