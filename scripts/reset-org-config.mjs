/**
 * Developer-only: reset org catalog and settings to product defaults.
 * Does not touch tasks, users, addresses, or contacts. Existing tasks keep
 * frozen type/custom-field snapshots.
 *
 * Tenants configure org settings in Management; there is no in-app reset.
 *
 * Usage:
 *   node scripts/reset-org-config.mjs
 *   node scripts/reset-org-config.mjs --dry-run
 */
import { createPgClient } from './lib/db.mjs';
import {
	DEFAULT_ORG_SETTINGS,
	DEFAULT_TASK_TYPES,
} from './lib/org-config-defaults.mjs';

const dryRun = process.argv.includes('--dry-run');

const client = createPgClient();
await client.connect();

try {
	const settingsRes = await client.query(
		`SELECT external_key_label, cancel_retention_days, required_task_fields, accent_color
     FROM org_settings WHERE id = 1`,
	);
	const typesRes = await client.query(
		`SELECT name, slug FROM org_task_types WHERE retired_at IS NULL ORDER BY sort_order, id`,
	);
	const fieldsRes = await client.query(
		`SELECT entity_type, slot, label, data_type FROM org_custom_field_defs ORDER BY entity_type, slot`,
	);

	const currentSettings = settingsRes.rows[0];
	const activeTypes = typesRes.rows;
	const customFields = fieldsRes.rows;

	console.log('Current org config:');
	console.log(
		`  settings: label="${currentSettings?.external_key_label ?? '?'}", retention=${currentSettings?.cancel_retention_days ?? 'null'}, accent=${currentSettings?.accent_color ?? '?'}, required fields=${JSON.stringify(currentSettings?.required_task_fields ?? [])}`,
	);
	console.log(
		`  task types (${activeTypes.length}): ${activeTypes.map((t) => t.name).join(', ') || '(none)'}`,
	);
	console.log(
		`  custom fields (${customFields.length}): ${customFields.map((f) => f.label).join(', ') || '(none)'}`,
	);

	console.log('\nWill reset to:');
	console.log(
		`  settings: label="${DEFAULT_ORG_SETTINGS.externalKeyLabel}", retention=${DEFAULT_ORG_SETTINGS.cancelRetentionDays}, accent=${DEFAULT_ORG_SETTINGS.accentColor}, required fields=[]`,
	);
	console.log(
		`  task types (${DEFAULT_TASK_TYPES.length}): ${DEFAULT_TASK_TYPES.map((t) => t.name).join(', ')}`,
	);
	console.log('  custom fields: (none)');

	if (dryRun) {
		console.log('\nDry run — no changes written.');
	} else {
		await client.query('BEGIN');

		await client.query(
			`UPDATE org_task_types SET retired_at = now() WHERE retired_at IS NULL`,
		);

		for (const taskType of DEFAULT_TASK_TYPES) {
			await client.query(
				`INSERT INTO org_task_types (
           name, slug, icon, enabled, sort_order, plural_name
         ) VALUES ($1, $2, $3, true, $4, $5)`,
				[
					taskType.name,
					taskType.slug,
					taskType.icon,
					taskType.sortOrder,
					taskType.pluralName,
				],
			);
		}

		await client.query(`DELETE FROM org_custom_field_defs`);

		await client.query(
			`UPDATE org_settings
       SET external_key_label = $1,
           cancel_retention_days = $2,
           required_task_fields = $3::text[],
           accent_color = $4,
           updated_at = now()
       WHERE id = 1`,
			[
				DEFAULT_ORG_SETTINGS.externalKeyLabel,
				DEFAULT_ORG_SETTINGS.cancelRetentionDays,
				DEFAULT_ORG_SETTINGS.requiredTaskFields,
				DEFAULT_ORG_SETTINGS.accentColor,
			],
		);

		await client.query('COMMIT');
		console.log('\nOrg config reset complete. Existing tasks were not modified.');
		console.log(
			'If the API is running, wait up to 30s for the org-settings cache to expire.',
		);
	}
} catch (err) {
	try {
		await client.query('ROLLBACK');
	} catch {
		// ignore
	}
	throw err;
} finally {
	await client.end();
}
