# Task attachment types (TATs)

- Catalog: `org_attachment_type_defs`; optional `task_attachments.attachment_type_id`.
- Dev seed slugs: `completion_photos`, `meter` — `seedDevAttachmentTypeDefs` in `scripts/lib/seedDevOrgConfig.mjs` (runs on `db:reset-org-config` and `db:seed-dev-tasks`).
- Tracking public images: union of `tatKeys` on `imageAttachments` blocks only; untagged rows never appear.
- Mobile capture: `TaskViewPage` Photo popover requires type pick (or “No type”) before camera/library when mobile viewport or Capacitor.
- Reassign: `PATCH /api/tasks/:id/attachments/:id` with `{ attachmentTypeId: null | number }` → `attachment_type_changed` history.
