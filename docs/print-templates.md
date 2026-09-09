# Print templates

Field generates PDFs from JSON **print templates** using a context-agnostic engine. Templates declare a **context** (`task`, `report`, …); **context providers** supply tag data.

## Three layers

| Layer | What it is | Who sees it |
| ----- | ---------- | ----------- |
| **Document type** | Global business slot (`delivery_docket`, `invoice`, …) — label, onTrackingPage flag, menu group | Task menu, tracking page, history |
| **Print template** | Per-org layout JSON in `org_print_templates` — blocks, context, persist, surfaces | Server render; dev browser |
| **Template name** | Human label for dev filtering (`"Acme invoice 2026"`) | Dev only — not in task menu |

Document types live in [`shared/documentTypes.js`](../shared/documentTypes.js). Per-org layouts live in the DB table `org_print_templates` (one active row per `(org_id, document_type)`).

**Storage kind:** `task_documents.kind` is the document type key directly (e.g. `delivery_docket`), not `print:{key}`.

**Seeds:** JSON files in [`document-templates/`](../document-templates/) are import-only. Run `npm run db:seed-print-templates` (or `npm run db:schema`, which seeds after migrations) to load them into org 1.

## Template schema

```json
{
  "label": "Delivery Docket",
  "context": "task",
  "surfaces": { "taskMenu": true },
  "requiresStatus": null,
  "persist": true,
  "page": "letter",
  "margin": 50,
  "blocks": [ … ]
}
```

| Field | Purpose |
| ----- | ------- |
| `context` | `"task"` or `"report"` — selects the context provider |
| `surfaces.taskMenu` | Show in task detail → More actions (task context only) |
| `requiresStatus` | Optional guard (e.g. `"Completed"`) before rendering |
| `persist` | When true with task context, upsert `task_documents` |
| `blocks` | Layout blocks (see below) |

### Report templates (future)

Report templates use `context: "report"`. The report context provider is a **stub** — `POST /api/print/:documentType` with report context returns `501 Not implemented`.

## Block types

Same block vocabulary as before: `header`, `metaRow`, `section`, `row`, `multiline`, `spacer`, `text`, `imageAttachments`, `signature`, `titleBar`, `columns`, `labeledLine`, `lineStack`, `table`, `totalRow`, `cutHere`.

Tags use `{{task.id}}`, `{{company.name}}`, etc. Task tags are built in [`server/printContexts/task.mjs`](../server/printContexts/task.mjs).

## API

| Route | Purpose |
| ----- | ------- |
| `GET /api/document-types` | Global document type registry |
| `GET /api/print-templates?context=task&surface=taskMenu` | Menu entries for authenticated org (document types, not template names) |
| `GET /api/org/print-templates` | Full org payload + revision for client cache |
| `POST /api/print/:documentType` | Render PDF (`?download=1` for attachment) |

**Task body:**

```json
{ "context": "task", "taskId": 123 }
```

Org settings include `printTemplatesRevision` — a hash of all `(document_type, content_hash)` pairs. The client compares this on load and refreshes its localStorage cache when it changes.

## Task UI

Task detail → **More actions** shows **document types** grouped by `menuGroup` (e.g. Documents → Delivery docket). Items come from the client cache, which is synced via org settings revision. Orgs with no template for a type hide that item.

## Dev browser

With `npm run dev`, open **Development → Print templates** (`/development/document-templates`):

- Filter by org, document type, context, and template name
- List summaries: org, name, type, context, hash, updated_at
- Edit JSON, **Save** to DB (recomputes `content_hash`, bumps revision)
- **Preview PDF** for task-context templates (task fixture or task ID)

Dev routes (Vite middleware, dev only):

| Method | Route |
| ------ | ----- |
| GET | `/api/dev/print-templates?orgId=&documentType=&context=&q=` |
| GET | `/api/dev/print-templates/:id` |
| PUT | `/api/dev/print-templates/:id` |
| POST | `/api/dev/print-templates/:id/preview` |
| GET | `/api/dev/print-templates/tags` |

## Adding a template for org 1

1. Optionally add or edit a seed JSON in `document-templates/` (must match a valid document type key).
2. Run `npm run db:seed-print-templates`, or insert/update via the dev browser.
3. Set `surfaces.taskMenu: true` to expose the type in task detail.
4. Set `persist: true` if the PDF should be stored in `task_documents`.

## Architecture

```
shared/documentTypes.js     — global registry (labels, public, menu groups)
org_print_templates (DB)    — per-org layout JSON + content_hash
        ↓
server/print.mjs            — load by org + documentType, render
server/orgPrintTemplates.mjs — DB access, revision hash
server/renderDocumentTemplate.mjs — PDFKit blocks (context-agnostic)
server/printContexts/task.mjs     — task tags + attachments
src/printTemplateCache.ts   — localStorage cache keyed by revision
```

See also: [`pdf-delivery-docket.md`](pdf-delivery-docket.md) (delivery docket layout reference).
