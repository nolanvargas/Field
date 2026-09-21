# Development workflow (GitHub Issues + Projects)

Field uses **GitHub Issues** for work items and a **user Project** board for Kanban. Specs stay in [`sdd.md`](sdd.md). Weekly focus and phased work live on the [Field Development Board](https://github.com/users/nolanvargas/projects/1) (Status + Priority).

**Board:** [Field Development Board](https://github.com/users/nolanvargas/projects/1)

## Board layout

Group the board by **Status** (single select), in this order:

| Status | Meaning |
|--------|---------|
| Backlog | Not started; pick from here |
| Ready | Scoped and ready to start |
| In progress | Active branch / session |
| In review | PR open |
| Done | Merged or closed |

Use the separate **Priority** field (P0 / P1 / P2) — keep it aligned with issue labels `priority:p0` / `priority:p1` / `priority:p2`. Priority is not a Status column.

**WIP:** Pull highest Priority from **Backlog** / **Ready** first. If you are solo, keep at most one card in **In progress**.

## Board automation

Two systems keep Issues and the board in sync:

1. **Project Workflows (primary)** — on the board: `…` → **Workflows**
   - **Auto-add to project** for repo `Field` (`is:issue,pr is:open`)
   - **Item closed** → set **Status** to **Done**
2. **GitHub Actions (backup)** — [`.github/workflows/project-board.yml`](../.github/workflows/project-board.yml)
   - Adds opened/reopened issues to the board
   - Sets **Status → Done** when issues/PRs close
   - Needs repository secret `ADD_TO_PROJECT_PAT` (classic PAT with `repo` + `project` scopes)

You usually do **not** need to run `gh project item-add` by hand for new issues.

## Where truth lives

| Artifact | Role |
|----------|------|
| [`docs/sdd.md`](sdd.md) | Behavior and architecture |
| [`docs/testing-strategy.md`](testing-strategy.md) | Unit vs integration vs manual QA |
| GitHub Issues | Shippable slices with acceptance criteria |
| Project board | Status and Priority fields |

Do not copy the full roadmap into issues — link the relevant doc section in the issue body.

## Labels

**Priority (pick one):** `priority:p0`, `priority:p1`, `priority:p2`

**Type:** `type:feature`, `type:bug`, `type:chore`, `type:docs`, `type:qa`, `type:analysis`

**Area:** `area:web`, `area:mobile`, `area:api`, `area:pdf-email`, `area:infra`, `area:security`

**Phase:** `phase:0-quality`, `phase:1-security`, `phase:2-tests`, `phase:3-deploy`, `phase:4-ops`, `phase:5-mvp`

New issues land on the board in **Backlog**. Set **Priority** (and keep the matching `priority:*` label) when you triage.

## Issue body template

```markdown
## Context
(1-2 sentences)

## Acceptance
- [ ] …

## Links
- docs/…
- related issue numbers (if any)
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
| Urgent issues | `gh issue list --repo nolanvargas/Field --label priority:p0` |
| All open issues | `gh issue list --repo nolanvargas/Field` |
| New task | `gh issue create --repo nolanvargas/Field --template task` |
| Start work | `gh issue develop <n> --repo nolanvargas/Field --checkout` |
| Open PR | `gh pr create --fill` (include `Closes #<n>` in body) |
| List projects | `gh project list --owner nolanvargas` |
| Manual add to board | `gh project item-add 1 --owner nolanvargas --url https://github.com/nolanvargas/Field/issues/<n>` |

Manual add is rarely needed when Project Workflows / Actions are on. After adding, set **Status** and **Priority** on the board if automation did not.

## Pull requests

Use [`.github/pull_request_template.md`](../.github/pull_request_template.md). CI runs lint, test, and build on every PR (see [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

`main` is protected: changes need a PR, and the CI job `check` must pass. Force-push and deleting `main` are blocked.

Link issues with `Closes #12` so GitHub closes the issue on merge; Project **Item closed** (and/or Actions) then moves the card to **Done**.

## Branch protection (light)

- PRs required into `main` (0 approving reviews — solo-friendly)
- Required status check: `check` (CI)
- No force-push / no deleting `main`
- Ruleset: **Protect main (light)**

## Branch and pull request habit

One shippable slice per branch, tied to an issue:

1. Pick an issue from the board (prefer highest **Priority** in **Backlog** / **Ready**).
2. Create a branch from an up-to-date \main\ (example: \eat/15-task-access\ or \gh issue develop <n> --checkout\).
3. Keep Desktop Field on that branch while you work so local stays in step with the PR.
4. Open a PR into \main\ before merging. In the PR body, use \Closes #<n>\ when the PR fully finishes the issue.
5. Wait for CI (\check\) to pass, then merge. Delete the branch after merge.
6. Pull \main\ locally so the next slice starts clean.

Dependabot may open weekly npm update PRs (labels \	ype:chore\, \rea:infra\). Review and merge those like any other PR — they still need green CI.

