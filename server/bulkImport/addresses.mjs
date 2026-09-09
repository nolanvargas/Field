import { getPool } from '../db.mjs';
import { formatStreetLineFromImportParts } from '../../shared/addressImport.js';
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
function mapAddress(row, defs) {
	return {
		id: String(row.id),
		addressName: row.address_name ?? '',
		street: row.street_line ?? '',
		city: '',
		state: '',
		postalCode: '',
		building: row.building ?? '',
		notes: row.notes ?? '',
		...storedCustomFieldCells(row.custom_fields, defs),
	};
}

/**
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function importedAddressFields(fields, defs) {
	return {
		addressName: fields.addressName ?? '',
		street: fields.street ?? '',
		city: fields.city ?? '',
		state: fields.state ?? '',
		postalCode: fields.postalCode ?? '',
		building: fields.building ?? '',
		notes: fields.notes ?? '',
		...importedCustomFieldCells(fields, defs),
	};
}

/**
 * @param {Record<string, string>} fields
 */
function streetLineFromFields(fields) {
	return formatStreetLineFromImportParts(fields);
}

/**
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 */
function addressFieldsEqual(a, b, defs) {
	return (
		a.addressName === b.addressName &&
		streetLineFromFields(a) === streetLineFromFields(b) &&
		a.building === b.building &&
		a.notes === b.notes &&
		customFieldCellsEqual(a, b, defs)
	);
}

/**
 * @param {Array<{ rowIndex: number; fields: Record<string, string>; errors: string[] }>} parsedRows
 * @param {import('../customFields.mjs').CustomFieldDef[]} [customFieldDefs]
 */
export async function previewAddressesImport(parsedRows, customFieldDefs = []) {
	const defs = customFieldDefs;
	const pool = getPool();
	const { rows: existingRows } = await pool.query(
		`SELECT id, address_name, street_line, building, notes, custom_fields
     FROM addresses WHERE deleted_at IS NULL`,
	);

	/** @type {Map<string, ReturnType<typeof mapAddress>>} */
	const byName = new Map();
	/** @type {Map<string, ReturnType<typeof mapAddress>>} */
	const byId = new Map();
	for (const row of existingRows) {
		const mapped = mapAddress(row, defs);
		byId.set(mapped.id, mapped);
		const key = normalizeMatchKey(mapped.addressName);
		if (key && !byName.has(key)) byName.set(key, mapped);
	}

	/** @type {import('./types.mjs').ImportPreviewRow[]} */
	const rows = [];
	const summary = { new: 0, update: 0, conflict: 0, error: 0 };

	for (const parsed of parsedRows) {
		const imported = importedAddressFields(parsed.fields, defs);
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

		const streetLine = streetLineFromFields(imported);
		if (!streetLine) {
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'error',
				errors: ['Street is required'],
				imported,
			});
			summary.error++;
			continue;
		}
		if (streetLine.length > 500) {
			rows.push({
				rowIndex: parsed.rowIndex,
				status: 'error',
				errors: ['Combined street address must be 500 characters or fewer'],
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
					errors: ['Id must be a numeric address id'],
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
					errors: [`Address id ${idRaw} not found`],
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

		const nameKey = normalizeMatchKey(imported.addressName);
		const match = nameKey ? byName.get(nameKey) : undefined;
		if (match) {
			if (addressFieldsEqual(imported, match, defs)) {
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
export async function applyAddressesImport(applyRows, customFieldDefs = []) {
	const pool = getPool();
	let created = 0;
	let updated = 0;
	/** @type {string[]} */
	const errors = [];

	for (const row of applyRows) {
		if (row.status === 'error') continue;
		const fields = resolveAddressFields(row);
		const streetLine = streetLineFromFields(fields);
		if (!streetLine) {
			errors.push(`Row ${row.rowIndex}: street is required`);
			continue;
		}
		if (streetLine.length > 500) {
			errors.push(
				`Row ${row.rowIndex}: combined street address must be 500 characters or fewer`,
			);
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
					`INSERT INTO addresses (address_name, street_line, building, notes, custom_fields)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
					[
						fields.addressName?.trim().slice(0, 255) || null,
						streetLine,
						fields.building?.trim().slice(0, 255) || null,
						fields.notes?.trim() || null,
						customFields,
					],
				);
				created++;
			} else {
				const { rowCount } = await pool.query(
					`UPDATE addresses
           SET address_name = $2, street_line = $3, building = $4, notes = $5,
               custom_fields = $6::jsonb
           WHERE id = $1::int AND deleted_at IS NULL`,
					[
						Number(row.matchId),
						fields.addressName?.trim().slice(0, 255) || null,
						streetLine,
						fields.building?.trim().slice(0, 255) || null,
						fields.notes?.trim() || null,
						customFields,
					],
				);
				if (rowCount === 0) {
					errors.push(`Row ${row.rowIndex}: address not found`);
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
function resolveAddressFields(row) {
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
