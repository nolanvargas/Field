-- Destination lives on the task so per-job edits do not mutate the addresses catalog.
-- addresses remains master data for search / autocomplete prefills only.
-- destination_address_id is an optional link to the catalog venue used to prefill.

BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS destination_address_name varchar(255),
  ADD COLUMN IF NOT EXISTS destination_address varchar(500),
  ADD COLUMN IF NOT EXISTS destination_building varchar(255),
  ADD COLUMN IF NOT EXISTS destination_notes text;

-- Backfill from the linked catalog row for existing tasks.
UPDATE tasks AS t
SET
  destination_address_name = COALESCE(
    t.destination_address_name,
    NULLIF(btrim(a.address_name), '')
  ),
  destination_address = COALESCE(
    t.destination_address,
    NULLIF(btrim(a.street_line), '')
  ),
  destination_building = COALESCE(
    t.destination_building,
    NULLIF(btrim(a.building), '')
  ),
  destination_notes = COALESCE(
    t.destination_notes,
    NULLIF(btrim(a.notes), '')
  )
FROM addresses AS a
WHERE t.destination_address_id = a.id;

COMMIT;
