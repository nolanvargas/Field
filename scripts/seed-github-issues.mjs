#!/usr/bin/env node
/**
 * Seed initial backlog issues (skip if title already exists). Run after labels:
 *   node scripts/seed-github-labels.mjs
 *   node scripts/seed-github-issues.mjs
 */
import { execSync } from 'node:child_process';

const REPO = 'nolanvargas/Field';

const issues = [
	{
		title: 'Manual QA program — one domain per session',
		labels: 'priority:p0,type:qa,phase:0-quality',
		body: `## Context
Run through manual test domains one at a time to catch regressions before shared deploy.

## Acceptance
- [ ] Complete each domain in [manual-test-overview.md](https://github.com/nolanvargas/Field/blob/main/docs/manual-test-overview.md) and check it off
- [ ] Note date in overview **Completed** section when a domain pass is done

## Links
- [Field Development Board](https://github.com/users/nolanvargas/projects/1) rank 1
- Project Status: **Backlog P0**`,
	},
	{
		title: 'Licensed MVP parity matrix',
		labels: 'priority:p0,type:analysis,phase:5-parity',
		body: `## Context
Build feature × licensed product × Field × priority matrix so remaining work matches licensed FWM scope.

## Acceptance
- [ ] Matrix exists (spreadsheet or doc under \`docs/\`)
- [ ] Gaps prioritized; roadmap phases reference it

## Links
- [Field Issues §16](https://github.com/nolanvargas/Field/issues)
- [Field Development Board](https://github.com/users/nolanvargas/projects/1) rank 2
- Project Status: **Backlog P0**`,
	},
	{
		title: 'Expand automated tests: PDF, email, task create/status',
		labels: 'priority:p1,type:chore,phase:2-tests,area:api',
		body: `## Context
Protect critical pipelines with automated tests beyond pure unit coverage.

## Acceptance
- [ ] Meaningful tests for PDF generation path
- [ ] Meaningful tests for email pipeline
- [ ] Meaningful tests for task create and status transitions

## Links
- [Field Development Board](https://github.com/users/nolanvargas/projects/1) rank 3
- Project Status: **Backlog P1**`,
	},
	{
		title: 'Document testing strategy (unit, integration, manual)',
		labels: 'priority:p1,type:docs,phase:2-tests',
		body: `## Context
Clarify when to use Vitest unit tests, integration tests, and manual domains.

## Acceptance
- [ ] Doc under \`docs/\` describes each layer and when to add which
- [ ] Linked from README or dev-workflow

## Links
- [Field Issues Phase 2](https://github.com/nolanvargas/Field/issues)
- Project Status: **Backlog P1**`,
	},
	{
		title: 'Restore and maintain .env.example for contributors',
		labels: 'priority:p1,type:chore,phase:0-quality,area:infra',
		body: `## Context
New contributors need a committed env template with required vs optional keys.

## Acceptance
- [ ] \`.env.example\` in repo with non-secret placeholders
- [ ] README first-run references it

## Links
- [Field Issues local dev gap](https://github.com/nolanvargas/Field/issues)
- Project Status: **Backlog P1**`,
	},
];

function listOpenTitles() {
	const out = execSync(`gh issue list --repo ${REPO} --state open --json title`, {
		encoding: 'utf8',
	});
	return JSON.parse(out).map((i) => i.title);
}

const existing = listOpenTitles();

for (const issue of issues) {
	if (existing.includes(issue.title)) {
		console.log(`skip (exists): ${issue.title}`);
		continue;
	}
	const bodyFile = process.env.TEMP + `\\field-issue-${Date.now()}.md`;
	// write via node fs
	const fs = await import('node:fs');
	fs.writeFileSync(bodyFile, issue.body, 'utf8');
	try {
		execSync(
			`gh issue create --repo ${REPO} --title "${issue.title.replace(/"/g, '\\"')}" --label "${issue.labels}" --body-file "${bodyFile}"`,
			{ stdio: 'inherit', shell: true },
		);
	} finally {
		fs.unlinkSync(bodyFile);
	}
}

console.log('\nOpen issues:');
execSync(`gh issue list --repo ${REPO}`, { stdio: 'inherit', shell: true });
