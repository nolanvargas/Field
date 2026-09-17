/**
 * Copy Sandbocks org logo into local storage and point org_settings at it.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORG_LOGO_STORAGE_KEY } from '../../shared/orgLogo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const STORAGE_ROOT = path.join(ROOT, 'storage');
const LOGO_SOURCE = path.join(ROOT, 'assets', 'org-logos', 'sandbocks.svg');

/**
 * @param {import('pg').Client} client
 */
export async function seedSandbocksOrgLogo(client) {
	const destPath = path.join(STORAGE_ROOT, ORG_LOGO_STORAGE_KEY);
	await mkdir(path.dirname(destPath), { recursive: true });
	await copyFile(LOGO_SOURCE, destPath);

	await client.query(
		`UPDATE org_settings
     SET logo_storage_key = $1,
         logo_mime_type = 'image/svg+xml',
         logo_updated_at = now(),
         updated_at = now()
     WHERE id = 1`,
		[ORG_LOGO_STORAGE_KEY],
	);
}
