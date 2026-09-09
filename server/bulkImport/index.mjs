import {
	IMPORT_ENTITIES,
	importTemplateFilename,
} from '../../shared/importColumns.js';
import { importCustomFieldDefs } from './customFields.mjs';
import { parseImportCsv } from './parse.mjs';
import { buildImportCsv } from './rows.mjs';
import { previewContactsImport, applyContactsImport } from './contacts.mjs';
import { previewAddressesImport, applyAddressesImport } from './addresses.mjs';
import { previewUsersImport, applyUsersImport } from './users.mjs';

/**
 * @param {string} entity
 * @returns {entity is import('../../shared/importColumns.js').ImportEntity}
 */
export function isImportEntity(entity) {
	return IMPORT_ENTITIES.includes(/** @type {import('../../shared/importColumns.js').ImportEntity} */ (entity));
}

/**
 * @param {string} mode
 * @returns {mode is 'blank' | 'sample' | 'current'}
 */
export function parseImportMode(mode) {
	if (mode === 'sample' || mode === 'current' || mode === 'blank') return mode;
	return 'blank';
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {'blank' | 'sample' | 'current'} mode
 */
export async function getImportTemplate(entity, mode) {
	const csv = await buildImportCsv(entity, mode);
	return {
		csv,
		fileName: importTemplateFilename(entity, mode),
	};
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {string} csvText
 */
export async function previewImport(entity, csvText) {
	const defs = await importCustomFieldDefs(entity);
	const { rows: parsedRows } = parseImportCsv(entity, csvText, defs);
	if (entity === 'contacts') return previewContactsImport(parsedRows, defs);
	if (entity === 'addresses') return previewAddressesImport(parsedRows, defs);
	return previewUsersImport(parsedRows, defs);
}

/**
 * @param {import('../../shared/importColumns.js').ImportEntity} entity
 * @param {import('./types.mjs').ImportApplyRow[]} rows
 * @param {string} actorUserId
 */
export async function applyImport(entity, rows, actorUserId) {
	const defs = await importCustomFieldDefs(entity);
	if (entity === 'contacts') return applyContactsImport(rows, defs);
	if (entity === 'addresses') return applyAddressesImport(rows, defs);
	return applyUsersImport(rows, actorUserId, defs);
}
