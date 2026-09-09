/**
 * Custom field cells for bulk import/export.
 *
 * Cells are keyed `cf:{slot}` so they flow through the existing flat
 * `Record<string, string>` row shape, including conflict resolution.
 */

import {
	IMPORT_CUSTOM_FIELD_ENTITY,
	customFieldColumnKey,
} from '../../shared/importColumns.js';
import { isCustomFieldImportPlaceholder } from '../../shared/customFieldPlaceholders.js';
import { assertLookupValues, parseCustomFields } from '../customFields.mjs';
import { entityCustomFieldDefs } from '../entityCustomFields.mjs';
import { formatBooleanCell, parseBooleanCell } from './boolean.mjs';

/**
 * Live org defs for an import entity's records.
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @returns {Promise<import('../customFields.mjs').CustomFieldDef[]>}
 */
export function importCustomFieldDefs(entity) {
	return entityCustomFieldDefs(IMPORT_CUSTOM_FIELD_ENTITY[entity]);
}

/**
 * Stored value → CSV cell. Lookups export the catalog id (not the display name)
 * so an exported file re-imports unchanged. Placeholders export blank.
 * @param {import('../customFields.mjs').CustomFieldDef} def
 * @param {unknown} value
 * @returns {string}
 */
function valueToCell(def, value) {
	if (value == null || value === '') return '';
	if (isCustomFieldImportPlaceholder(value)) return '';
	if (def.dataType === 'boolean') return formatBooleanCell(value === true);
	if (Array.isArray(value)) return value.map(String).join(', ');
	return String(value);
}

/**
 * The `cf:` cells a CSV row supplied, defaulted to blank for absent columns.
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {Record<string, string>}
 */
export function importedCustomFieldCells(fields, defs) {
	/** @type {Record<string, string>} */
	const out = {};
	for (const def of defs) {
		const key = customFieldColumnKey(def.slot);
		out[key] = String(fields[key] ?? '').trim();
	}
	return out;
}

/**
 * Existing DB values rendered as cells, for preview comparison and export.
 * @param {unknown} stored
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {Record<string, string>}
 */
export function storedCustomFieldCells(stored, defs) {
	const values =
		stored && typeof stored === 'object' && !Array.isArray(stored)
			? /** @type {Record<string, unknown>} */ (stored)
			: {};
	/** @type {Record<string, string>} */
	const out = {};
	for (const def of defs) {
		out[customFieldColumnKey(def.slot)] = valueToCell(
			def,
			values[String(def.slot)],
		);
	}
	return out;
}

/**
 * Compare only the `cf:` cells of two row shapes.
 * @param {Record<string, string>} a
 * @param {Record<string, string>} b
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {boolean}
 */
export function customFieldCellsEqual(a, b, defs) {
	for (const def of defs) {
		const key = customFieldColumnKey(def.slot);
		if ((a[key] ?? '') !== (b[key] ?? '')) return false;
	}
	return true;
}

/**
 * Cells → JSONB values to persist. A blank required cell stores the placeholder
 * sentinel instead of failing the row.
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {Record<string, unknown>}
 */
export function customFieldsFromCells(fields, defs) {
	if (defs.length === 0) return {};
	/** @type {Record<string, unknown>} */
	const raw = {};
	for (const def of defs) {
		const cell = String(fields[customFieldColumnKey(def.slot)] ?? '').trim();
		if (!cell) continue;
		// Boolean cells use the spreadsheet vocabulary (TRUE/T/Y/…) that
		// `parseCustomFields` does not accept.
		raw[String(def.slot)] =
			def.dataType === 'boolean' ? parseBooleanCell(cell) : cell;
	}
	return parseCustomFields(raw, defs, { placeholderForRequired: true });
}

/**
 * Round-trip the `cf:` cells through parse + render so comparison against
 * stored values is not tripped by equivalent spellings (`Y` vs `TRUE`,
 * `A,B` vs `A, B`, `5.0` vs `5`). Throws when a cell is invalid.
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {Record<string, string>}
 */
export function normalizeCustomFieldCells(fields, defs) {
	if (defs.length === 0) return {};
	return storedCustomFieldCells(customFieldsFromCells(fields, defs), defs);
}

/**
 * Parse, verify lookup targets exist, and serialize for the `custom_fields`
 * JSONB column. Throws so the caller records a row error.
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }> }} db
 * @param {Record<string, string>} fields
 * @param {import('../customFields.mjs').CustomFieldDef[]} defs
 * @returns {Promise<string>}
 */
export async function customFieldsJsonFromCells(db, fields, defs) {
	const values = customFieldsFromCells(fields, defs);
	await assertLookupValues(db, values, defs);
	return JSON.stringify(values);
}
