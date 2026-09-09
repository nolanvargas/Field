-- Places API place id for addresses geocoded via autocomplete or batch CLI.
-- NULL for manual pin placement or not yet geocoded.

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS google_place_id varchar(255);
