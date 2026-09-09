-- Per-org web identity provider (null = use server env fallback until configured).

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS web_auth_provider varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS web_auth_config jsonb NOT NULL DEFAULT '{}'::jsonb;
