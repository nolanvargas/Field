/**
 * CSV column definitions for bulk import/export (contacts, addresses, users).
 */

/** @typedef {'contacts' | 'addresses' | 'users'} ImportEntity */

export const IMPORT_ENTITIES = /** @type {const} */ ([
	'contacts',
	'addresses',
	'users',
]);

/** @type {Record<ImportEntity, string>} */
export const IMPORT_ENTITY_LABELS = {
	contacts: 'Contacts',
	addresses: 'Addresses',
	users: 'Users',
};

/**
 * @typedef {{ key: string; header: string; required?: boolean; exportOnly?: boolean }} ImportColumnDef
 */

/** @type {Record<ImportEntity, ImportColumnDef[]>} */
export const IMPORT_COLUMNS = {
	contacts: [
		{
			key: 'id',
			header: 'Id',
			exportOnly: true,
		},
		{ key: 'name', header: 'Name', required: true },
		{ key: 'title', header: 'Title' },
		{ key: 'phone', header: 'Phone' },
		{ key: 'email', header: 'Email' },
	],
	addresses: [
		{
			key: 'id',
			header: 'Id',
			exportOnly: true,
		},
		{ key: 'addressName', header: 'Address name' },
		{ key: 'street', header: 'Street', required: true },
		{ key: 'city', header: 'City' },
		{ key: 'state', header: 'State' },
		{ key: 'postalCode', header: 'Postal code' },
		{ key: 'building', header: 'Building' },
		{ key: 'notes', header: 'Notes' },
	],
	users: [
		{
			key: 'id',
			header: 'Id',
			exportOnly: true,
		},
		{ key: 'displayName', header: 'Name', required: true },
		{ key: 'email', header: 'Email' },
		{ key: 'phone', header: 'Phone' },
		{ key: 'role', header: 'Role' },
		{ key: 'manageUsers', header: 'Manage users' },
		{ key: 'manageOrg', header: 'Manage organization' },
		{ key: 'viewCrewMap', header: 'View crew map' },
		{ key: 'viewAllTasks', header: 'View all tasks' },
	],
};

/** Import entity → the custom field entity type its records use. */
export const IMPORT_CUSTOM_FIELD_ENTITY = {
	contacts: 'contact',
	addresses: 'address',
	users: 'user',
};

const CUSTOM_FIELD_COLUMN_PREFIX = 'cf:';

/**
 * @param {number} slot
 * @returns {string}
 */
export function customFieldColumnKey(slot) {
	return `${CUSTOM_FIELD_COLUMN_PREFIX}${slot}`;
}

/**
 * @param {string} key
 * @returns {number | null}
 */
export function parseCustomFieldColumnKey(key) {
	const raw = String(key ?? '');
	if (!raw.startsWith(CUSTOM_FIELD_COLUMN_PREFIX)) return null;
	const slot = Number(raw.slice(CUSTOM_FIELD_COLUMN_PREFIX.length));
	return Number.isInteger(slot) && slot >= 1 ? slot : null;
}

/**
 * Custom field columns are never `required`: a blank required cell stores a
 * placeholder sentinel rather than failing the row.
 * @param {Array<{ slot: number, label: string }>} defs
 * @returns {ImportColumnDef[]}
 */
export function customFieldImportColumns(defs) {
	return (Array.isArray(defs) ? defs : [])
		.filter((def) => String(def?.label ?? '').trim().length > 0)
		.sort((a, b) => a.slot - b.slot)
		.map((def) => ({
			key: customFieldColumnKey(def.slot),
			header: String(def.label).trim(),
		}));
}

/**
 * @param {ImportEntity} entity
 * @param {'template' | 'export'} mode
 * @param {Array<{ slot: number, label: string }>} [customFieldDefs]
 */
export function importColumnsForMode(entity, mode = 'template', customFieldDefs = []) {
	const builtins = IMPORT_COLUMNS[entity];
	const cols = mode === 'export' ? builtins : builtins.filter((c) => !c.exportOnly);
	return [...cols, ...customFieldImportColumns(customFieldDefs)];
}

/**
 * @param {ImportEntity} entity
 * @param {'template' | 'export'} mode
 * @param {Array<{ slot: number, label: string }>} [customFieldDefs]
 */
export function importHeaders(entity, mode = 'template', customFieldDefs = []) {
	return importColumnsForMode(entity, mode, customFieldDefs).map((c) => c.header);
}

/** Header aliases → column key (per entity). */
const ID_HEADER_ALIASES = new Set([
	'id',
	'id (optional — leave blank for new)',
	'id (optional - leave blank for new)',
]);

/**
 * @param {ImportEntity} entity
 * @param {string} header
 * @param {Array<{ slot: number, label: string }>} [customFieldDefs]
 * @returns {string | null}
 */
export function normalizeImportHeader(entity, header, customFieldDefs = []) {
	const trimmed = String(header ?? '')
		.replace(/^\uFEFF/, '')
		.trim();
	const lower = trimmed.toLowerCase();

	if (ID_HEADER_ALIASES.has(lower)) return 'id';

	const cols = IMPORT_COLUMNS[/** @type {ImportEntity} */ (entity)];
	for (const col of cols) {
		if (col.header.toLowerCase() === lower) return col.key;
	}

	// Custom field labels are tenant-defined and may collide with a builtin
	// header; builtins win so a rename cannot hijack an existing column.
	for (const col of customFieldImportColumns(customFieldDefs)) {
		if (col.header.toLowerCase() === lower) return col.key;
	}

	// Common short aliases
	if (entity === 'addresses') {
		if (lower === 'name') return 'addressName';
		if (lower === 'street line' || lower === 'street address' || lower === 'address') {
			return 'street';
		}
		if (lower === 'zip' || lower === 'zip code' || lower === 'postcode') {
			return 'postalCode';
		}
		if (lower === 'province') return 'state';
	}
	if (entity === 'users' && lower === 'name') return 'displayName';

	return null;
}

/**
 * @param {ImportEntity} entity
 * @returns {string}
 */
export function importTemplateFilename(entity, mode = 'blank') {
	const base = `${entity}-import`;
	if (mode === 'sample') return `${base}-sample.csv`;
	if (mode === 'current') return `${base}-export.csv`;
	return `${base}-template.csv`;
}
