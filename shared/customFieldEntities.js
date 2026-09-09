/**
 * Entity types that can carry org-configured custom fields.
 * Slots are scoped per entity: `org_custom_field_defs` is keyed (entity_type, slot).
 */

export const CUSTOM_FIELD_ENTITIES = Object.freeze({
	task: 'task',
	user: 'user',
	contact: 'contact',
	address: 'address',
});

/** @type {readonly string[]} */
export const ALL_CUSTOM_FIELD_ENTITIES = Object.freeze([
	CUSTOM_FIELD_ENTITIES.task,
	CUSTOM_FIELD_ENTITIES.user,
	CUSTOM_FIELD_ENTITIES.contact,
	CUSTOM_FIELD_ENTITIES.address,
]);

export const CUSTOM_FIELD_ENTITY_SET = new Set(ALL_CUSTOM_FIELD_ENTITIES);

/** Entity types whose records validate against live org defs (no frozen snapshot). */
export const MASTER_DATA_CUSTOM_FIELD_ENTITIES = Object.freeze([
	CUSTOM_FIELD_ENTITIES.user,
	CUSTOM_FIELD_ENTITIES.contact,
	CUSTOM_FIELD_ENTITIES.address,
]);

export const CUSTOM_FIELD_ENTITY_LABELS = {
	[CUSTOM_FIELD_ENTITIES.task]: 'Task',
	[CUSTOM_FIELD_ENTITIES.user]: 'User',
	[CUSTOM_FIELD_ENTITIES.contact]: 'Contact',
	[CUSTOM_FIELD_ENTITIES.address]: 'Address',
};

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomFieldEntity(value) {
	return typeof value === 'string' && CUSTOM_FIELD_ENTITY_SET.has(value);
}

/**
 * Throws 400 for anything outside the known entity types.
 * @param {unknown} value
 * @returns {string}
 */
export function assertCustomFieldEntity(value) {
	if (!isCustomFieldEntity(value)) {
		throw Object.assign(new Error(`Unknown custom field entity: ${value}`), {
			status: 400,
		});
	}
	return String(value);
}

/**
 * @template T
 * @param {() => T} makeValue
 * @returns {Record<string, T>}
 */
export function byCustomFieldEntity(makeValue) {
	/** @type {Record<string, T>} */
	const out = {};
	for (const entity of ALL_CUSTOM_FIELD_ENTITIES) {
		out[entity] = makeValue();
	}
	return out;
}

/**
 * @param {unknown} raw
 * @returns {Record<string, unknown[]>}
 */
export function customFieldDefsByEntityFrom(raw) {
	const source = raw && typeof raw === 'object' ? raw : {};
	/** @type {Record<string, unknown[]>} */
	const out = {};
	for (const entity of ALL_CUSTOM_FIELD_ENTITIES) {
		const value = /** @type {Record<string, unknown>} */ (source)[entity];
		out[entity] = Array.isArray(value) ? value : [];
	}
	return out;
}
