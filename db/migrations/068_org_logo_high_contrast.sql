-- White backdrop behind nav logo row when org logo lacks contrast on the sidebar.

BEGIN;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS logo_high_contrast boolean NOT NULL DEFAULT false;

COMMIT;
