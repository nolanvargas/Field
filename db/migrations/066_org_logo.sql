-- Per-org logo for customer branding (UI, emails, PDFs).

BEGIN;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS logo_storage_key varchar(500) NULL;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS logo_mime_type varchar(100) NULL;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz NULL;

COMMIT;
