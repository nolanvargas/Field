#!/usr/bin/env node
/**
 * Add all open Field issues to a GitHub Project v2 board.
 * Requires: gh auth refresh -h github.com -s read:project,project
 *
 *   node scripts/link-github-project-items.mjs <PROJECT_NUMBER>
 *
 * Then set each card Status on the board to Backlog P0/P1/P2 per priority:* label.
 */
import { execSync } from 'node:child_process';

const REPO = 'nolanvargas/Field';
const OWNER = 'nolanvargas';

const projectNumber = process.argv[2];
if (!projectNumber) {
	console.error('Usage: node scripts/link-github-project-items.mjs <PROJECT_NUMBER>');
	console.error('Find number: gh project list --owner nolanvargas');
	process.exit(1);
}

const issues = JSON.parse(
	execSync(`gh issue list --repo ${REPO} --state open --json number`, { encoding: 'utf8' }),
);

for (const { number } of issues) {
	const url = `https://github.com/${REPO}/issues/${number}`;
	console.log(`add #${number} …`);
	execSync(`gh project item-add ${projectNumber} --owner ${OWNER} --url ${url}`, {
		stdio: 'inherit',
		shell: true,
	});
}

console.log('Done. Set Status columns on the board (Backlog P0 / P1 / P2).');
