#!/usr/bin/env node
/**
 * Sync sites/fieldfwm/ to S3 and optionally invalidate CloudFront.
 *
 * Env (or sites/fieldfwm/deploy.local.env):
 *   FIELD_FWM_WWW_BUCKET          — required
 *   FIELD_FWM_CF_DISTRIBUTION_ID  — optional; invalidates /* when set
 *   AWS_REGION                    — bucket region (default us-east-1)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = path.join(root, 'sites', 'fieldfwm');
const envFile = path.join(siteDir, 'deploy.local.env');

function loadLocalEnv() {
	if (!existsSync(envFile)) return;
	for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (key && process.env[key] === undefined) process.env[key] = value;
	}
}

function aws(args) {
	execFileSync('aws', args, { stdio: 'inherit', shell: process.platform === 'win32' });
}

loadLocalEnv();

const bucket = process.env.FIELD_FWM_WWW_BUCKET?.trim();
const distributionId = process.env.FIELD_FWM_CF_DISTRIBUTION_ID?.trim();
const region = process.env.AWS_REGION?.trim() || 'us-east-1';

if (!bucket) {
	console.error(
		'Set FIELD_FWM_WWW_BUCKET (S3 bucket name). Optional: FIELD_FWM_CF_DISTRIBUTION_ID.\n' +
			'Copy sites/fieldfwm/deploy.env.example → deploy.local.env (gitignored) or export vars.',
	);
	process.exit(1);
}

console.log(`Deploying ${siteDir} → s3://${bucket}/ (${region})`);

aws([
	's3',
	'sync',
	siteDir,
	`s3://${bucket}/`,
	'--delete',
	'--region',
	region,
	'--cache-control',
	'public,max-age=300',
	'--exclude',
	'deploy.local.env',
	'--exclude',
	'deploy.env.example',
	'--exclude',
	'README.md',
]);

if (distributionId) {
	console.log(`Invalidating CloudFront ${distributionId}…`);
	aws([
		'cloudfront',
		'create-invalidation',
		'--distribution-id',
		distributionId,
		'--paths',
		'/*',
	]);
} else {
	console.log('No FIELD_FWM_CF_DISTRIBUTION_ID — skip CloudFront invalidation.');
}

console.log('Done.');
