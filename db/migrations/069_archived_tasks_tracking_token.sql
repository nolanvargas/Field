-- Keep archived_tasks in sync with tasks.tracking_token (064 renamed tasks only).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'archived_tasks'
      AND column_name = 'public_token'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'archived_tasks'
      AND column_name = 'tracking_token'
  ) THEN
    ALTER TABLE archived_tasks RENAME COLUMN public_token TO tracking_token;
  END IF;
END $$;

COMMIT;
