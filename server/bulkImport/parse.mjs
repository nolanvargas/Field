import {
	IMPORT_COLUMNS,
	normalizeImportHeader,
} from '../../shared/importColumns.js';
import { parseCsv, stripUtf8Bom } from '../../shared/csv.js';
import { parseBooleanCell } from './boolean.mjs';
import { normalizeCustomFieldCells } from './customFields.mjs';

/**
 * @param {string} value
 */
export function normalizeMatchKey(value) {
	return String(value ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {string} text
 * @param {Array<{ slot: number, label: string }>} [customFieldDefs]
 */
export function parseImportCsv(entity, text, customFieldDefs = []) {
	const rawRows = parseCsv(stripUtf8Bom(text));
	if (rawRows.length === 0) {
		throw Object.assign(new Error('CSV file is empty'), { status: 400 });
	}

	const [headerRow, ...dataRows] = rawRows;
	const columnKeys = [];
	const unknownHeaders = [];

	for (const header of headerRow) {
		const key = normalizeImportHeader(entity, header, customFieldDefs);
		if (!key) {
			unknownHeaders.push(String(header ?? '').trim());
			columnKeys.push(null);
		} else {
			columnKeys.push(key);
		}
	}

	if (unknownHeaders.filter(Boolean).length > 0) {
		throw Object.assign(
			new Error(`Unknown column(s): ${unknownHeaders.filter(Boolean).join(', ')}`),
			{ status: 400 },
		);
	}

	const requiredKeys = IMPORT_COLUMNS[entity]
		.filter((c) => c.required)
		.map((c) => c.key);
	const presentKeys = new Set(columnKeys.filter(Boolean));
	for (const key of requiredKeys) {
		if (!presentKeys.has(key)) {
			const col = IMPORT_COLUMNS[entity].find((c) => c.key === key);
			throw Object.assign(
				new Error(`Missing required column: ${col?.header ?? key}`),
				{ status: 400 },
			);
		}
	}

	/** @type {Array<{ rowIndex: number; fields: Record<string, string>; errors: string[] }>} */
	const rows = [];

	for (let i = 0; i < dataRows.length; i++) {
		const cols = dataRows[i];
		if (cols.every((c) => !String(c ?? '').trim())) continue;

		/** @type {Record<string, string>} */
		const fields = {};
		const errors = [];

		for (let j = 0; j < columnKeys.length; j++) {
			const key = columnKeys[j];
			if (!key) continue;
			fields[key] = String(cols[j] ?? '').trim();
		}

		for (const key of requiredKeys) {
			if (!fields[key]) {
				const col = IMPORT_COLUMNS[entity].find((c) => c.key === key);
				errors.push(`${col?.header ?? key} is required`);
			}
		}

		if (entity === 'users') {
			for (const permKey of [
				'manageUsers',
				'manageOrg',
				'viewCrewMap',
				'viewAllTasks',
			]) {
				const raw = fields[permKey] ?? '';
				if (!raw) {
					fields[permKey] = 'FALSE';
					continue;
				}
				try {
					fields[permKey] = parseBooleanCell(raw) ? 'TRUE' : 'FALSE';
				} catch (err) {
					const col = IMPORT_COLUMNS.users.find((c) => c.key === permKey);
					errors.push(
						err instanceof Error
							? `${col?.header ?? permKey}: ${err.message}`
							: `${col?.header ?? permKey} is invalid`,
					);
				}
			}
		}

		try {
			Object.assign(fields, normalizeCustomFieldCells(fields, customFieldDefs));
		} catch (err) {
			errors.push(
				err instanceof Error ? err.message : 'Custom field value is invalid',
			);
		}

		rows.push({ rowIndex: i + 2, fields, errors });
	}

	return { rows };
}
