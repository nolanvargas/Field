-- Remove legacy Wodely sync system user (reassign FKs to another active user when present).

DO $$
DECLARE
  wodely_id uuid := 'a0000000-0000-4000-8000-000000000001';
  fallback_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = wodely_id) THEN
    RETURN;
  END IF;

  SELECT id INTO fallback_id
  FROM users
  WHERE id <> wodely_id AND is_active = true
  ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF fallback_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE tasks SET created_by_user_id = fallback_id WHERE created_by_user_id = wodely_id;
  UPDATE task_crew_members SET user_id = fallback_id WHERE user_id = wodely_id;
  UPDATE task_attachments SET uploaded_by_user_id = fallback_id WHERE uploaded_by_user_id = wodely_id;
  UPDATE task_documents SET generated_by_user_id = fallback_id WHERE generated_by_user_id = wodely_id;
  UPDATE task_crew_events SET user_id = fallback_id WHERE user_id = wodely_id;
  UPDATE task_completion_notes SET user_id = fallback_id WHERE user_id = wodely_id;
  UPDATE tasks SET completion_notes_by_user_id = fallback_id WHERE completion_notes_by_user_id = wodely_id;
  UPDATE task_history_events SET actor_user_id = fallback_id WHERE actor_user_id = wodely_id;
  UPDATE mobile_activation_codes SET created_by_user_id = fallback_id WHERE created_by_user_id = wodely_id;
  UPDATE mobile_activation_codes SET user_id = fallback_id WHERE user_id = wodely_id;
  UPDATE mobile_devices SET user_id = fallback_id WHERE user_id = wodely_id;
  UPDATE mobile_devices SET revoked_by_user_id = fallback_id WHERE revoked_by_user_id = wodely_id;

  DELETE FROM users WHERE id = wodely_id;
END $$;
