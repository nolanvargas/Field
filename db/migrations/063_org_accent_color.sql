-- Org accent color for UI chrome, emails, and the public tracking page.
-- One hex; shades are derived in application code.

BEGIN;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS accent_color varchar(7) NOT NULL DEFAULT '#732e75';

ALTER TABLE org_settings
  DROP CONSTRAINT IF EXISTS org_settings_accent_color_hex;

ALTER TABLE org_settings
  ADD CONSTRAINT org_settings_accent_color_hex
  CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');

COMMIT;
