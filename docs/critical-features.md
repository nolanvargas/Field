# Critical Features

Features confirmed as **critical** for Field — required for parity with the licensed product and for a minimum functioning delivery workflow. These are not optional add-ons.

See also: [`task-model.md`](task-model.md), [`database-design.md`](database-design.md), [`sdd.md`](sdd.md).

---

## 1. PDF Document Generation

The system must generate PDF documents tied to tasks. Three document types are critical:

| Document | Purpose | Typical timing (TBD) |
|----------|---------|----------------------|
| **Shipping label** | Label for physical shipment / load identification | On assign or load (e.g. status → `loaded`) |
| **Delivery docket** | Instructions and details for the crew / job packet | On assign or before execution |
| **Proof of Completion** | Completion record (the generalized POD) — may include photos, notes, signature | On task completion |

**Requirements (draft):**

- PDFs are **generated server-side** from task data (and completion data for POD).
- Store generated files via storage provider — **local `./storage/documents` in dev**; **S3 in production**. Metadata in `task_documents`.
- Web users can **view and download** PDFs; mobile crew members may **view/print** docket and submit data that feeds POD generation.
- POD likely incorporates `task_attachments` (photos) and `completed_notes` / `completed_at`.

**Documented so far:**

- **Delivery docket** layout + field map: [`pdf-delivery-docket.md`](pdf-delivery-docket.md) (from licensed-product sample). Generator: `server/deliveryDocket.mjs` — `GET /api/tasks/:id/delivery-docket` / UI Print / `npm run pdf:docket`.

**Not yet defined:**

- Exact trigger per document type (status change, manual button, both).
- Shipping label and POD PDF layouts (need samples).
- Whether shipping label integrates with a carrier API or is an internal printable label only.

**Likely implementation:**

- Template-based PDF generation in the API layer — **PDFKit** for delivery docket (`server/deliveryDocket.mjs`); shipping label / POD later.
- One template per document type; version templates as requirements stabilize.

---

## 2. Automatic Email Sending

The system **sends emails automatically** when a task reaches a terminal status. Contacts and triggers are tied to tasks; see [`email-triggers.md`](email-triggers.md) for the full decision flow. **Verified accurate after review** — this section documents implemented behavior, not a draft spec.

**Triggers (implemented):**

- Emails fire when a task transitions into `Completed` or `Failed`:
  - **Crew-driven** — the last active crew member logs `ended` and the task resolves to `Completed` / `Failed` (`POST /api/tasks/:id/crew-events`).
  - **Manual / admin** — a status change to `Completed` / `Failed` (`PATCH /api/tasks/:id/status`).
- Task types that email: `Delivery`, `Install`, `Removal`, `Site Survey`. `Pickup` and `Other` never email.
- Recipients are the task's contacts with `receives_email = true` and a non-blank `contacts.email`. Crew and internal staff are never emailed.
- No email is sent on task assignment or load — those triggers are out of scope.

**Guards (all must pass):**

- New status is exactly `Completed` or `Failed`, and it actually changed (`fromStatus !== toStatus`).
- Task exists and is not deleted.
- The task has not already been emailed for this trigger — a `sent` row in `email_deliveries` for the same `task_id` + trigger suppresses the send, so re-entering a terminal status does not re-send. A previously `failed` row does not block a retry.
- At least one matching recipient.

**Templates:**

| Status | Task type | Template (`emails/`) | Trigger logged |
|--------|-----------|----------------------|----------------|
| `Completed` | Delivery | `order-delivered.html` — "Your order has been delivered!" | `task_completed` |
| `Completed` | Install / Removal / Site Survey | `task-completed.html` | `task_completed` |
| `Failed` | Delivery / Install / Removal / Site Survey | `task-failed.html` | `task_failed` |

**Delivery (implemented):**

| Environment | Provider |
|-------------|----------|
| Local dev | Console log (`EMAIL_PROVIDER=console`) |
| Production | Amazon SES (`EMAIL_PROVIDER=ses`, default) |

Every attempt is logged in `email_deliveries` (`pending` → `sent` / `failed`) with trigger, subject, recipient, and provider message id. Failed sends are recorded and retryable; a send failure never fails the status-change request. From-address is `EMAIL_FROM` (default `noreply@qcdlv.net`); `EMAIL_CONFIGURATION_SET` (default `notify_on_error`) is applied when configured.

**Manual verification only:** `npm run email:test` sends a single test email through the same pipeline and bypasses the status gates.

---

## Relationship to Task Lifecycle

```text
create task → assign → [delivery docket PDF] → loaded → [shipping label PDF]
    → execute → complete + photos → [POD PDF] → [automatic emails at key steps]
```

PDF generation and email sending are **downstream of task state**. Design status transitions and completion flows first; hook documents and emails into those events.

---

## MVP Note

These features are **critical**, but template polish and every possible trigger do not all need to ship on day one. Minimum acceptable MVP:

1. At least **one PDF type** generating correctly from real task data.
2. At least **one automatic email** on a defined event (e.g. completion → contact). — **Implemented**: terminal-status emails, see [`email-triggers.md`](email-triggers.md).
3. Logging/storage for generated PDFs and sent emails. — **Implemented**: `email_deliveries` audit log.

Expand to all three PDF types and full trigger matrix once the pipeline works end-to-end.

---

## Open Questions

- Sample PDFs for **shipping label** and standalone **POD** (delivery docket sample captured)?
- Include PDF as attachment, link only, or both?
- SMS required later, or email only for now?
