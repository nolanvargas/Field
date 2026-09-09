-- Org-level configuration: task types, equipment, external key pattern, custom field defs.
-- Converts tasks.task_type from enum to varchar so org_task_types can add custom types.

BEGIN;

CREATE TABLE org_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  external_key_label varchar(100) NOT NULL DEFAULT 'Job',
  external_key_regex varchar(200) NOT NULL DEFAULT '\d{5,6}',
  cancel_retention_days int,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE org_task_types (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  icon varchar(100) NOT NULL DEFAULT 'CircleHelp',
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  shows_equipment boolean NOT NULL DEFAULT false
);

CREATE TABLE org_equipment_options (
  id serial PRIMARY KEY,
  label varchar(100) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE org_custom_field_defs (
  slot smallint PRIMARY KEY CHECK (slot >= 1 AND slot <= 5),
  label varchar(100) NOT NULL DEFAULT '',
  data_type varchar(50) NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  lookup_table varchar(100)
);

-- Allow org-configured task type names beyond the legacy enum.
ALTER TABLE tasks ALTER COLUMN task_type TYPE varchar(100) USING task_type::text;

DROP TYPE IF EXISTS task_type;

INSERT INTO org_settings (id, external_key_label, external_key_regex, cancel_retention_days)
VALUES (1, 'Job', '\d{5,6}', 7);

INSERT INTO org_task_types (name, slug, icon, enabled, sort_order, shows_equipment) VALUES
  ('Delivery', 'Delivery', 'Truck', true, 0, false),
  ('Install', 'Install', 'Wrench', true, 1, true),
  ('Removal', 'Removal', 'PackageMinus', true, 2, true),
  ('Site Survey', 'Site Survey', 'ClipboardCheck', true, 3, true),
  ('Pickup', 'Pickup', 'Package', true, 4, false),
  ('Other', 'Other', 'CircleHelp', true, 5, false);

INSERT INTO org_equipment_options (label, sort_order, enabled) VALUES
  ('Lift', 0, true),
  ('Ladder', 1, true);

COMMIT;
