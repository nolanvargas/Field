-- Rename public_* tracking identifiers to tracking_* (greenfield naming).

ALTER TABLE tasks RENAME COLUMN public_token TO tracking_token;

ALTER INDEX IF EXISTS tasks_public_token_uidx RENAME TO tasks_tracking_token_uidx;

ALTER TABLE org_task_types RENAME COLUMN public_page_template TO tracking_page_template;
