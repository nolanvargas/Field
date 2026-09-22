# GitHub Issues and Projects

- **Issues were disabled** on `nolanvargas/Field` until enabled via API (`has_issues=true`). New repos may need the same patch or repo Settings → Features → Issues.
- **`gh project` and GraphQL `projectsV2`** need token scopes `read:project` and `project`. Run interactively: `gh auth refresh -h github.com -s read:project,project`.
- **Seed scripts:** `node scripts/seed-github-labels.mjs`, `node scripts/seed-github-issues.mjs`, then `node scripts/link-github-project-items.mjs <PROJECT_NUMBER>` after project scopes are granted.
- **Phase label:** use `phase:5-mvp` for post-checklist product gaps — not `phase:5-parity` (removed; Field is greenfield, see `product-framing-greenfield.md`).
- **Workflow doc:** `docs/dev-workflow.md`.
