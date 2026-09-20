# Critical features (PDF + email)

Field treats **PDF generation** and **automatic email** as MVP requirements, not post-launch add-ons.

## Source of truth

| Topic | Document |
| ----- | -------- |
| Product intent and pipeline overview | [`sdd.md`](sdd.md) §8 |
| When emails actually send (verified) | [`email-triggers.md`](email-triggers.md) |
| Delivery docket layout | [`pdf-delivery-docket.md`](pdf-delivery-docket.md) |
| Print templates API and UI | [`print-templates.md`](print-templates.md) |

## MVP checklist (high level)

| Feature | Status (2026-09-20) |
| ------- | ------------------- |
| Delivery docket PDF | On demand via print templates / API |
| Proof of completion PDF | On demand + public tracking download |
| Shipping label PDF | Not implemented |
| Automatic email on Completed / Failed | Implemented; `email_deliveries` audit log |
| Event-driven PDF generation (all doc types) | Not implemented — PDFs are on-demand today |

Local smoke: `npm run email:test`. Production email needs SES + `PUBLIC_APP_URL` for tracking CTAs — see [`AGENTS/ses-fieldwm-domain.md`](AGENTS/ses-fieldwm-domain.md).
