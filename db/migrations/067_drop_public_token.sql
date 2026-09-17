-- Finish rename from 064 when both public_token and tracking_token exist.

BEGIN;

UPDATE tasks
SET tracking_token = public_token
WHERE tracking_token IS NULL
  AND public_token IS NOT NULL;

ALTER TABLE tasks DROP COLUMN IF EXISTS public_token;

DROP INDEX IF EXISTS tasks_public_token_uidx;

ALTER TABLE tasks
  ALTER COLUMN tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_tracking_token_uidx
  ON tasks (tracking_token);

COMMIT;
