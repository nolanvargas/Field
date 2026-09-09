-- Extra access keys on users. role remains a human-interpreted label.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}';

UPDATE users
SET permissions = ARRAY['manage_users', 'manage_org', 'view_crew_map']::text[]
WHERE role = 'admin'
  AND (permissions IS NULL OR permissions = '{}');

COMMIT;
