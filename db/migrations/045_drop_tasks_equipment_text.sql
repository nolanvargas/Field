-- equipment_option_ids replaces tasks.equipment text[].

BEGIN;

ALTER TABLE tasks DROP COLUMN IF EXISTS equipment;

COMMIT;
