-- Add Cancelled status (voided / cancelled tasks).

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'Cancelled';
