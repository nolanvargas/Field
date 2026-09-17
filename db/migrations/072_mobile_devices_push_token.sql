-- FCM device token for crew push notifications (one per mobile_devices row).

BEGIN;

ALTER TABLE mobile_devices
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS push_token_updated_at timestamptz;

COMMIT;
