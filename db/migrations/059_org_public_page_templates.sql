-- Per–task-type public tracking page layout (canvas + regions).
BEGIN;

ALTER TABLE org_task_types
  ADD COLUMN IF NOT EXISTS public_page_template jsonb;

-- Seed defaults for existing catalog rows (Delivery keeps docket module).
UPDATE org_task_types
SET public_page_template = CASE name
  WHEN 'Delivery' THEN '{
    "version": 1,
    "canvas": { "aspectRatio": "3/4" },
    "regions": [
      {
        "id": "headline",
        "kind": "module",
        "module": "statusHeadline",
        "rect": { "x": 5, "y": 4, "w": 90, "h": 10 },
        "attrs": { "variant": "delivery" }
      },
      {
        "id": "details",
        "kind": "module",
        "module": "detailRows",
        "rect": { "x": 5, "y": 16, "w": 90, "h": 24 },
        "attrs": {
          "rows": [
            { "label": "Order", "tag": "task.job_title" },
            { "label": "Delivered to", "tag": "task.destination_name" },
            { "label": "Status", "tag": "task.status" },
            { "label": "Completed", "tag": "task.completed_at" }
          ]
        }
      },
      {
        "id": "docs",
        "kind": "module",
        "module": "documents",
        "rect": { "x": 5, "y": 42, "w": 90, "h": 14 },
        "attrs": { "kinds": ["delivery_docket", "proof_of_completion"] }
      },
      {
        "id": "timeline",
        "kind": "module",
        "module": "history",
        "rect": { "x": 5, "y": 58, "w": 90, "h": 38 }
      }
    ]
  }'::jsonb
  ELSE '{
    "version": 1,
    "canvas": { "aspectRatio": "3/4" },
    "regions": [
      {
        "id": "headline",
        "kind": "module",
        "module": "statusHeadline",
        "rect": { "x": 5, "y": 4, "w": 90, "h": 10 },
        "attrs": { "variant": "default" }
      },
      {
        "id": "details",
        "kind": "module",
        "module": "detailRows",
        "rect": { "x": 5, "y": 16, "w": 90, "h": 24 },
        "attrs": {
          "rows": [
            { "label": "Job", "tag": "task.job_title" },
            { "label": "Type", "tag": "task.task_type" },
            { "label": "Location", "tag": "task.destination_name" },
            { "label": "Status", "tag": "task.status" },
            { "label": "Completed", "tag": "task.completed_at" }
          ]
        }
      },
      {
        "id": "docs",
        "kind": "module",
        "module": "documents",
        "rect": { "x": 5, "y": 42, "w": 90, "h": 14 },
        "attrs": { "kinds": ["proof_of_completion"] }
      },
      {
        "id": "timeline",
        "kind": "module",
        "module": "history",
        "rect": { "x": 5, "y": 58, "w": 90, "h": 38 }
      }
    ]
  }'::jsonb
END
WHERE public_page_template IS NULL
  AND retired_at IS NULL;

COMMIT;
