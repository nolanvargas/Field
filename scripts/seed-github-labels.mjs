#!/usr/bin/env node
/**
 * Create Field issue labels (idempotent). Run from repo root:
 *   node scripts/seed-github-labels.mjs
 */
import { execSync } from 'node:child_process';

const REPO = 'nolanvargas/Field';

const labels = [
	['priority:p0', 'D93F3F', 'Backlog P0 — do first'],
	['priority:p1', 'FBCA04', 'Backlog P1 — next'],
	['priority:p2', '0E8A16', 'Backlog P2 — later'],
	['type:feature', '1D76DB', ''],
	['type:bug', 'B60205', ''],
	['type:chore', 'C5DEF5', ''],
	['type:docs', '0075CA', ''],
	['type:qa', 'F9D0C4', ''],
	['type:analysis', 'D4C5F9', ''],
	['area:web', '5319E7', ''],
	['area:mobile', 'BFDADC', ''],
	['area:api', '006B75', ''],
	['area:pdf-email', 'E99695', ''],
	['area:infra', 'FEF2C0', ''],
	['area:security', 'D93F0B', ''],
	['phase:0-quality', 'EDEDED', ''],
	['phase:1-security', 'EDEDED', ''],
	['phase:2-tests', 'EDEDED', ''],
	['phase:3-deploy', 'EDEDED', ''],
	['phase:4-ops', 'EDEDED', ''],
	['phase:5-mvp', 'EDEDED', ''],
];

for (const [name, color, description] of labels) {
	const descFlag = description ? ` -d "${description.replace(/"/g, '\\"')}"` : '';
	try {
		execSync(`gh label create "${name}" --repo ${REPO} --color ${color}${descFlag} --force`, {
			stdio: 'inherit',
			shell: true,
		});
	} catch {
		process.exitCode = 1;
	}
}
