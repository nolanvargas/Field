-- Per-user key to list/view tasks beyond own assignments.

BEGIN;

UPDATE users
SET permissions = array_append(permissions, 'view_all_tasks')
WHERE is_active = true
  AND (
    'manage_users' = ANY(permissions)
    OR 'manage_org' = ANY(permissions)
  )
  AND NOT ('view_all_tasks' = ANY(permissions));

COMMIT;
