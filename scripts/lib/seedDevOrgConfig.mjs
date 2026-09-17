/**
 * Sandbocks dev org catalog helpers — shared by reset-org-config and seed-dev-tasks.
 */
import {
	DEV_ATTACHMENT_TYPE_DEFS,
	DEV_CUSTOM_FIELD_DEFS,
} from './org-config-defaults.mjs';

/**
 * Upsert task custom field defs required by scripts/seed-dev-tasks.mjs.
 * Safe to call before every task seed; idempotent on (entity_type, slot).
 *
 * @param {import('pg').Client} client
 * @returns {Promise<number>} number of defs written
 */
export async function seedDevTaskCustomFieldDefs(client) {
	let count = 0;
	for (const field of DEV_CUSTOM_FIELD_DEFS) {
		await client.query(
			`INSERT INTO org_custom_field_defs (
         entity_type, slot, label, data_type, required, lookup_table, options
       ) VALUES ('task', $1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (entity_type, slot) DO UPDATE SET
         label = EXCLUDED.label,
         data_type = EXCLUDED.data_type,
         required = EXCLUDED.required,
         lookup_table = EXCLUDED.lookup_table,
         options = EXCLUDED.options`,
			[
				field.slot,
				field.label,
				field.dataType,
				field.required,
				field.lookupTable,
				JSON.stringify(field.options),
			],
		);
		count += 1;
	}
	return count;
}

/**
 * @param {import('pg').Client} client
 * @returns {Promise<number>}
 */
export async function seedDevAttachmentTypeDefs(client) {
	let count = 0;
	for (const def of DEV_ATTACHMENT_TYPE_DEFS) {
		const payload = [
			def.slug,
			def.label,
			JSON.stringify([...def.allowedMimeCategories]),
			def.showWhen ? JSON.stringify(def.showWhen) : null,
			def.sortOrder,
		];
		const updated = await client.query(
			`UPDATE org_attachment_type_defs
       SET label = $2,
           allowed_mime_categories = $3::jsonb,
           show_when = $4::jsonb,
           sort_order = $5,
           retired_at = NULL
       WHERE lower(slug) = lower($1) AND retired_at IS NULL`,
			payload,
		);
		if (updated.rowCount === 0) {
			await client.query(
				`INSERT INTO org_attachment_type_defs (
           slug, label, allowed_mime_categories, show_when, sort_order
         ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)`,
				payload,
			);
		}
		count += 1;
	}
	return count;
}
