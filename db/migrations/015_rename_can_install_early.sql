-- Field name: early start applies to all task types, not only Install.
-- Rename can_install_early → can_start_early (reference field was CanInstallEarly).

BEGIN;

ALTER TABLE tasks RENAME COLUMN can_install_early TO can_start_early;

COMMIT;
