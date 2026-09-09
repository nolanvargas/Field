-- Drop unused task_status enum labels Created and Loaded.
-- Data was remapped in 026 (Created → Unassigned) and 038 (Loaded → In Progress).

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.status::text IN ('Created', 'Loaded')
  ) THEN
    RAISE EXCEPTION 'tasks still reference Created or Loaded status';
  END IF;
  IF EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.status_before_cancel::text IN ('Created', 'Loaded')
  ) THEN
    RAISE EXCEPTION 'tasks.status_before_cancel still references Created or Loaded';
  END IF;
  IF EXISTS (
    SELECT 1 FROM task_history_events h
    WHERE h.from_status::text IN ('Created', 'Loaded')
       OR h.to_status::text IN ('Created', 'Loaded')
  ) THEN
    RAISE EXCEPTION 'task_history_events still references Created or Loaded';
  END IF;
  IF EXISTS (
    SELECT 1 FROM archived_tasks a
    WHERE a.status::text IN ('Created', 'Loaded')
       OR a.status_before_cancel::text IN ('Created', 'Loaded')
  ) THEN
    RAISE EXCEPTION 'archived_tasks still references Created or Loaded';
  END IF;
END $$;

DROP INDEX IF EXISTS tasks_cancelled_purge_idx;

DROP TYPE IF EXISTS task_status_new;

CREATE TYPE task_status_new AS ENUM (
  'Unassigned',
  'Assigned',
  'In Progress',
  'Completed',
  'Failed',
  'Undetermined',
  'Cancelled'
);

ALTER TABLE tasks
  ALTER COLUMN status TYPE task_status_new
  USING status::text::task_status_new;

ALTER TABLE tasks
  ALTER COLUMN status_before_cancel TYPE task_status_new
  USING status_before_cancel::text::task_status_new;

ALTER TABLE task_history_events
  ALTER COLUMN from_status TYPE task_status_new
  USING from_status::text::task_status_new;

ALTER TABLE task_history_events
  ALTER COLUMN to_status TYPE task_status_new
  USING to_status::text::task_status_new;

ALTER TABLE archived_tasks
  ALTER COLUMN status TYPE task_status_new
  USING status::text::task_status_new;

ALTER TABLE archived_tasks
  ALTER COLUMN status_before_cancel TYPE task_status_new
  USING status_before_cancel::text::task_status_new;

DROP TYPE task_status;
ALTER TYPE task_status_new RENAME TO task_status;

CREATE INDEX tasks_cancelled_purge_idx ON tasks (cancelled_at)
  WHERE status = 'Cancelled'::task_status AND deleted_at IS NULL;

COMMIT;
