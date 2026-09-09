-- Drop print: prefix and pod alias from task_documents.kind.

UPDATE task_documents
SET kind = 'delivery_docket'
WHERE kind = 'print:delivery_docket';

UPDATE task_documents
SET kind = 'proof_of_completion'
WHERE kind = 'pod';

UPDATE task_documents
SET kind = regexp_replace(kind, '^print:', '')
WHERE kind LIKE 'print:%';
