-- Reset public page templates to v2 block list (greenfield — no v1 conversion).
BEGIN;

UPDATE org_task_types
SET public_page_template = CASE name
  WHEN 'Delivery' THEN '{
    "version": 2,
    "blocks": [
      {
        "id": "headline",
        "type": "text",
        "html": "<h1>{{task.headline}}</h1>"
      },
      {
        "id": "details",
        "type": "detailRows",
        "rows": [
          { "label": "Order", "tag": "task.job_title" },
          { "label": "Delivered to", "tag": "task.destination_name" },
          { "label": "Status", "tag": "task.status" },
          { "label": "Completed", "tag": "task.completed_at" }
        ]
      },
      {
        "id": "docs",
        "type": "documents",
        "kinds": ["delivery_docket", "proof_of_completion"]
      },
      {
        "id": "timeline",
        "type": "history"
      }
    ]
  }'::jsonb
  ELSE '{
    "version": 2,
    "blocks": [
      {
        "id": "headline",
        "type": "text",
        "html": "<h1>{{task.headline}}</h1>"
      },
      {
        "id": "details",
        "type": "detailRows",
        "rows": [
          { "label": "Job", "tag": "task.job_title" },
          { "label": "Type", "tag": "task.task_type" },
          { "label": "Location", "tag": "task.destination_name" },
          { "label": "Status", "tag": "task.status" },
          { "label": "Completed", "tag": "task.completed_at" }
        ]
      },
      {
        "id": "docs",
        "type": "documents",
        "kinds": ["proof_of_completion"]
      },
      {
        "id": "timeline",
        "type": "history"
      }
    ]
  }'::jsonb
END
WHERE retired_at IS NULL;

COMMIT;
