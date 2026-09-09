-- Custom fields beyond tasks: org defs are scoped by entity type and each
-- master-data table carries its own slot-keyed JSONB values.
-- Master data has no defs snapshot: users, contacts, and addresses are living
-- records that always validate against the current org defs, unlike tasks which
-- freeze their defs at creation.

BEGIN;

ALTER TABLE org_custom_field_defs
  ADD COLUMN IF NOT EXISTS entity_type varchar(20) NOT NULL DEFAULT 'task';

ALTER TABLE org_custom_field_defs
  DROP CONSTRAINT IF EXISTS org_custom_field_defs_entity_type_check;

ALTER TABLE org_custom_field_defs
  ADD CONSTRAINT org_custom_field_defs_entity_type_check
  CHECK (entity_type IN ('task', 'user', 'contact', 'address'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.relname = 'org_custom_field_defs'
      AND i.indisprimary
      AND i.indnatts = 1
  ) THEN
    ALTER TABLE org_custom_field_defs
      DROP CONSTRAINT org_custom_field_defs_pkey;
    ALTER TABLE org_custom_field_defs
      ADD CONSTRAINT org_custom_field_defs_pkey PRIMARY KEY (entity_type, slot);
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
