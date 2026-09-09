-- Custom field defs are no longer capped at five slots.

BEGIN;

ALTER TABLE org_custom_field_defs
  DROP CONSTRAINT IF EXISTS org_custom_field_defs_slot_check;

ALTER TABLE org_custom_field_defs
  ADD CONSTRAINT org_custom_field_defs_slot_check CHECK (slot >= 1);

COMMIT;
