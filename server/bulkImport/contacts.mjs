import { getPool } from '../db.mjs';
import { normalizeMatchKey } from './parse.mjs';
import {
	customFieldCellsEqual,
	customFieldsJsonFromCells,
	importedCustomFieldCells,
	storedCustomFieldCells,
} from './customFields.mjs';

/**
 * @param {import('pg').QueryResultRow} row
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function mapContact(row, defs) {
	return {
		id: String(row.id),
		name: row.name ?? '',
		title: row.title ?? '',
		phone: row.phone ?? '',
		email: row.email ?? '',
		...storedCustomFieldCells(row.custom_fields, defs),
	};
}

/**
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function importedContactFields(fields, defs) {
	return {
		name: fields.name ?? '',
		title: fields.title ?? '',
		phone: fields.phone ?? '',
		email: fields.email ?? '',
		...importedCustomFieldCells(fields, defs),
	};
}

/**
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function contactFieldsEqual(a, b, defs) {
	return (
		a.name === b.name &&
		a.title === b.title &&
		a.phone === b.phone &&
		a.email === b.email &&
		customFieldCellsEqual(a, b, defs)
	);
}

/**
 * @param {Array<{ rowIndex: number; fields: Record<string, string>; errors: string[] }>} parsedRows
 * @param {import('../customFields.mjs').CustomFieldDef[]} [customFieldDefs]
 */
export async function previewContactsImport(parsedRows, customFieldDefs = []) {
	const defs = customFieldDefs;
	const pool = getPool();
	const { rows: existingRows } = await pool.query(
		`SELECT id, name, COALESCE(title, '') AS title, phone,
            COALESCE(email, '') AS email, custom_fields
     FROM contacts WHERE deleted_at IS NULL`,
	);

	/** @type {Map<string, ReturnType<typeof mapContact>>} */
	const byName = new Map();
	/** @type {Map<string, ReturnType<typeof mapContact>>} */
	const byId = new Map();
	for (const row of existingRows) {
		const mapped = mapContact(row, defs);
		byId.set(mapped.id, mapped);
		const key = normalizeMatchKey(mapped.name);
		if (key && !byName.has(key)) byName.set(key, mapped);
	}

	/** @type {import('./types.mjs').ImportPreviewRow[]} */
	const rows = [];
	const summary = { new: 0, update: 0, conflict: 0, error: 0 };

	for (const parsed of parsedRows) {
		const imported = importedContactFields(parsed.fields, defs);
		const idRaw = (parsed.fields.id ?? '').trim();

		if (parsed.errors.length > 0) {
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'error',
				errors: parsed.errors,
				imported,
			});
			summary.error++;
			continue;
		}

		if (idRaw) {
			if (!/^\d+$/.test(idRaw)) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'error',
					errors: ['Id must be a numeric contact id'],
					imported,
				});
				summary.error++;
				continue;
			}
			const existing = byId.get(idRaw);
			if (!existing) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'error',
					errors: [`Contact id ${idRaw} not found`],
					imported,
				});
				summary.error++;
				continue;
			}
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'update',
				matchId: idRaw,
				imported,
				existing,
			});
			summary.update++;
			continue;
		}

		const nameKey = normalizeMatchKey(imported.name);
		const match = nameKey ? byName.get(nameKey) : undefined;
		if (match) {
			if (contactFieldsEqual(imported, match, defs)) {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'update',
					matchId: match.id,
					imported,
					existing: match,
				});
				summary.update++;
			} else {
				rows.push({
					rowIndex: parsed.rowIndex,
					status: 'conflict',
					matchId: match.id,
					imported,
					existing: match,
				});
				summary.conflict++;
			}
			continue;
		}

		rows.push({
			rowIndex: parsed.rowIndex,
			status: 'new',
			imported,
		});
		summary.new++;
	}

	return { rows, summary };
}

/**
 * @param {import('./types.mjs').ImportApplyRow[]} applyRows
 * @param {import('../customFields.mjs').CustomFieldDef[]} [customFieldDefs]
 */
export async function applyContactsImport(applyRows, customFieldDefs = []) {
	const pool = getPool();
	let created = 0;
	let updated = 0;
	/** @type {string[]} */
	const errors = [];

	for (const row of applyRows) {
		if (row.status === 'error') continue;
		const fields = resolveContactFields(row);
		if (!fields.name?.trim()) {
			errors.push(`Row ${row.rowIndex}: name is required`);
			continue;
		}

		try {
			const customFields = await customFieldsJsonFromCells(
				pool,
				fields,
				customFieldDefs,
			);
			if (row.status === 'new' || !row.matchId) {
				await pool.query(
					`INSERT INTO contacts (name, title, phone, email, custom_fields)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
					[
						fields.name.trim().slice(0, 255),
						fields.title?.trim().slice(0, 255) || null,
						fields.phone?.trim().slice(0, 50) || null,
						fields.email?.trim().slice(0, 255) || null,
						customFields,
					],
				);
				created++;
			} else {
				const { rowCount } = await pool.query(
					`UPDATE contacts
           SET name = $2, title = $3, phone = $4, email = $5,
               custom_fields = $6::jsonb, updated_at = now()
           WHERE id = $1::int AND deleted_at IS NULL`,
					[
						Number(row.matchId),
						fields.name.trim().slice(0, 255),
						fields.title?.trim().slice(0, 255) || null,
						fields.phone?.trim().slice(0, 50) || null,
						fields.email?.trim().slice(0, 255) || null,
						customFields,
					],
				);
				if (rowCount === 0) {
					errors.push(`Row ${row.rowIndex}: contact not found`);
				} else {
					updated++;
				}
			}
		} catch (err) {
			errors.push(
				`Row ${row.rowIndex}: ${err instanceof Error ? err.message : 'Save failed'}`,
			);
		}
	}

	return { created, updated, errors };
}

/**
 * @param {import('./types.mjs').ImportApplyRow} row
 */
function resolveContactFields(row) {
	if (row.status !== 'conflict' || !row.existing || !row.resolution) {
		return row.imported;
	}
	/** @type {Record<string, string>} */
	const out = { ...row.imported };
	for (const [key, source] of Object.entries(row.resolution)) {
		if (source === 'existing' && key in row.existing) {
			out[key] = row.existing[key];
		}
	}
	return out;
}
