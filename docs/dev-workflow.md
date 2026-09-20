# Development workflow (GitHub Issues + Projects)

Field uses **GitHub Issues** for work items and a **repository Project** board for Kanban. Specs stay in [`sdd.md`](sdd.md) and [`roadmap.md`](roadmap.md); [`pickup.md`](../pickup.md) is the weekly hub (gaps, board link, “this week”).

## Board layout

Group the board by **Status** (single select), in this order:

| Status | Meaning |
|--------|---------|
| Backlog P0 | Do first — deploy risk, pickup ranks 1–2 |
| Backlog P1 | Next — quality, tests, defined MVP work |
| Backlog P2 | Later — parity-dependent product, AWS, polish |
| In Progress | Active branch / session |
| In Review | PR open |
| Done | Merged or closed |

Optional **Priority** field (P0 / P1 / P2) for table views — keep aligned with the backlog column while work is still in backlog.

**WIP:** Pull from **Backlog P0** first. If you are solo, keep at most one card in **In Progress**.

**Board:** [Field projects](https://github.com/nolanvargas/Field/projects)

## Where truth lives

| Artifact | Role |
|----------|------|
| [`docs/sdd.md`](sdd.md) | Behavior and architecture |
| [`docs/roadmap.md`](roadmap.md) | Phases and maturity |
| [`docs/testing-strategy.md`](testing-strategy.md) | Unit vs integration vs manual QA |
| [`pickup.md`](../pickup.md) | Weekly focus, gap snapshot, board URL |
| GitHub Issues | Shippable slices with acceptance criteria |
| Project board | Status and priority columns |

Do not copy the full roadmap into issues — link the relevant doc section in the issue body.

## Labels

**Priority (pick one):** `priority:p0`, `priority:p1`, `priority:p2`

**Type:** `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:qa`, `type:analysis`

**Area:** `area:web`, `area:mobile`, `area:api`, `area:pdf-email`, `area:infra`, `area:security`

**Phase:** `phase:0-quality`, `phase:1-security`, `phase:2-tests`, `phase:3-deploy`, `phase:4-ops`, `phase:5-parity`

New issues default to **Backlog P2** unless labeled `priority:p0` or `priority:p1`.

## Issue body template

```markdown
## Context
(1–2 sentences)

## Acceptance
- [ ] …

## Links
- docs/…
- pickup.md rank (if any)
```

## GitHub CLI setup

Refresh PATH on Windows if `gh` is not found (new terminal after install often works):

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
```

Projects API requires extra scopes (one-time, opens browser):

```bash
gh auth refresh -h github.com -s read:project,project
```

## Day-to-day commands

| Intent | Command |
|--------|---------|
| Urgent backlog | `gh issue list --repo nolanvargas/Field --label priority:p0` |
| All open issues | `gh issue list --repo nolanvargas/Field` |
| New task | `gh issue create --repo nolanvargas/Field --template task` |
| Start work | `gh issue develop <n> --repo nolanvargas/Field --checkout` |
| Open PR | `gh pr create --fill` (include `Closes #<n>` in body) |
| List projects | `gh project list --owner nolanvargas` |
| Add issue to board | `gh project item-add <PROJECT_NUMBER> --owner nolanvargas --url https://github.com/nolanvargas/Field/issues/<n>` |

After adding an issue to the project, set **Status** on the board (or via `gh project item-edit` once field IDs are known).

## Pull requests

Use [`.github/pull_request_template.md`](../.github/pull_request_template.md). CI runs lint, test, and build on every PR (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

Link issues with `Closes #12` so GitHub closes the issue on merge and automation can move the card to **Done** if you use project workflows.

## Link issues to the board (after auth refresh)

```bash
gh auth refresh -h github.com -s read:project,project
gh project list --owner nolanvargas
# For each open issue:
gh project item-add <PROJECT_NUMBER> --owner nolanvargas --url https://github.com/nolanvargas/Field/issues/<ISSUE_NUMBER>
```

Set each card’s Status to **Backlog P0**, **Backlog P1**, or **Backlog P2** to match its `priority:*` label.
