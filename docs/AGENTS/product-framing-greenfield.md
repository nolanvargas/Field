# Product framing — greenfield, not vendor parity

Field is an **original** FWM product. It is **not** scoped to match, replace, or achieve “parity” with any licensed third-party field-workforce tool.

## Do not use in plans, issues, or user-facing summaries

- “Licensed parity,” “parity matrix,” “functional parity with [vendor],” “replacement for licensed FWM”
- Treating exports/screenshots from other tools as the **requirements source of truth**

## Use instead

- **MVP scope** — [`docs/mvp-scope-checklist.md`](../mvp-scope-checklist.md), [`docs/pilot-uat-script.md`](../pilot-uat-script.md), [`docs/sdd.md`](../sdd.md), [`docs/critical-features.md`](../critical-features.md)
- **Task lifecycle completeness** — create → assign → execute → complete (+ agreed PDF/email pipeline)
- **Import aliases** — PascalCase columns in §5.6 are for data import/export naming, not “copy the other product’s UX”

## OK: “parity” in code/tests

Technical only: **client/server parity** (same normalization on web and API). Not product strategy.

## GitHub

- Phase backlog label: **`phase:5-mvp`** (not `phase:5-parity`).
- Scope sign-off: issue **#8** + [`docs/mvp-scope-checklist.md`](../mvp-scope-checklist.md).
