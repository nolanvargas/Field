-- Remove prescriptive headline text blocks from per-type tracking page templates.
BEGIN;

UPDATE org_task_types
SET tracking_page_template = jsonb_set(
  tracking_page_template,
  '{blocks}',
  COALESCE(
    (
      SELECT jsonb_agg(block ORDER BY ordinality)
      FROM jsonb_array_elements(tracking_page_template->'blocks')
        WITH ORDINALITY AS t(block, ordinality)
      WHERE NOT (
        block->>'id' = 'headline'
        AND block->>'type' = 'text'
      )
    ),
    '[]'::jsonb
  )
)
WHERE tracking_page_template IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(tracking_page_template->'blocks') AS block
    WHERE block->>'id' = 'headline'
      AND block->>'type' = 'text'
  );

COMMIT;
