-- Cache geocoded destination coordinates on tasks (Google Geocoding on demand).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS destination_latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS destination_longitude numeric(10, 7);
