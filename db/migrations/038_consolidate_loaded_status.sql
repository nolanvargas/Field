-- Consolidate Loaded → In Progress (Phase A).
-- Loaded remains in task_status enum as an unused value until a future cleanup migration.

UPDATE tasks
SET status = 'In Progress'
WHERE status = 'Loaded';

UPDATE task_history_events
SET from_status = 'In Progress'
WHERE from_status = 'Loaded';

UPDATE task_history_events
SET to_status = 'In Progress'
WHERE to_status = 'Loaded';
