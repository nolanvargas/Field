-- Phase D: move cancelled tasks past the org retention window into archived_tasks
-- (delete from tasks). Retention days come from org_settings.cancel_retention_days.
-- Supersedes migration 028's 7-day soft-delete purge (deleted_at on cancelled tasks).

BEGIN;

-- Mirror tasks row shape; id preserves the original task id (not a new identity).
CREATE TABLE archived_tasks (
  LIKE tasks INCLUDING DEFAULTS
);

ALTER TABLE archived_tasks
  ALTER COLUMN id DROP IDENTITY IF EXISTS;

ALTER TABLE archived_tasks
  ADD PRIMARY KEY (id);

ALTER TABLE archived_tasks
  ADD COLUMN archived_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN archive_reason varchar(50) NOT NULL DEFAULT 'cancel_retention',
  ADD COLUMN related_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX archived_tasks_archived_at_idx ON archived_tasks (archived_at);

COMMENT ON TABLE archived_tasks IS
  'Cancelled tasks moved out of tasks after cancel_retention_days. '
  'Related rows are snapshotted in related_snapshot then removed with the task.';

COMMIT;
