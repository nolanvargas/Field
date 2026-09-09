/**
 * Built-in task form fields tenants can mark required.
 * Custom field required flags live on org_custom_field_defs, not here.
 */

export const REQUIRED_TASK_FIELDS = Object.freeze({
	externalKey: 'externalKey',
	jobTitle: 'jobTitle',
	taskDesc: 'taskDesc',
	contacts: 'contacts',
	destinationName: 'destinationName',
	destinationAddress: 'destinationAddress',
	destinationBuilding: 'destinationBuilding',
	destinationNotes: 'destinationNotes',
	afterDateTime: 'afterDateTime',
	beforeDateTime: 'beforeDateTime',
	crew: 'crew',
});

/** @type {readonly string[]} */
export const ALL_REQUIRED_TASK_FIELDS = Object.freeze([
	REQUIRED_TASK_FIELDS.externalKey,
	REQUIRED_TASK_FIELDS.jobTitle,
	REQUIRED_TASK_FIELDS.taskDesc,
	REQUIRED_TASK_FIELDS.contacts,
	REQUIRED_TASK_FIELDS.destinationName,
	REQUIRED_TASK_FIELDS.destinationAddress,
	REQUIRED_TASK_FIELDS.destinationBuilding,
	REQUIRED_TASK_FIELDS.destinationNotes,
	REQUIRED_TASK_FIELDS.afterDateTime,
	REQUIRED_TASK_FIELDS.beforeDateTime,
	REQUIRED_TASK_FIELDS.crew,
]);

export const REQUIRED_TASK_FIELD_SET = new Set(ALL_REQUIRED_TASK_FIELDS);

export const REQUIRED_TASK_FIELD_LABELS = {
	[REQUIRED_TASK_FIELDS.externalKey]: 'External key',
	[REQUIRED_TASK_FIELDS.jobTitle]: 'Job title',
	[REQUIRED_TASK_FIELDS.taskDesc]: 'Task information',
	[REQUIRED_TASK_FIELDS.contacts]: 'Contacts',
	[REQUIRED_TASK_FIELDS.destinationName]: 'Venue',
	[REQUIRED_TASK_FIELDS.destinationAddress]: 'Street address',
	[REQUIRED_TASK_FIELDS.destinationBuilding]: 'Building, floor and room',
	[REQUIRED_TASK_FIELDS.destinationNotes]: 'Destination notes',
	[REQUIRED_TASK_FIELDS.afterDateTime]: 'Complete After',
	[REQUIRED_TASK_FIELDS.beforeDateTime]: 'Complete Before',
	[REQUIRED_TASK_FIELDS.crew]: 'Assign To',
};

/**
 * @param {string} key
 * @param {{ externalKeyLabel?: string | null }} [opts]
 * @returns {string}
 */
export function requiredTaskFieldLabel(key, opts = {}) {
	if (key === REQUIRED_TASK_FIELDS.externalKey) {
		const label = String(opts.externalKeyLabel ?? '').trim();
		if (label) return "External Key: " + label;
	}
	return REQUIRED_TASK_FIELD_LABELS[key] ?? key;
}

/**
 * @param {unknown} keys
 * @param {string} key
 * @returns {boolean}
 */
export function isTaskFieldRequired(keys, key) {
	return Array.isArray(keys) && keys.includes(key);
}

/**
 * Drop unknown keys from a DB array. Does not throw.
 * @param {unknown} value
 * @returns {string[]}
 */
export function requiredTaskFieldsFromDb(value) {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(key) => typeof key === 'string' && REQUIRED_TASK_FIELD_SET.has(key),
	);
}

/**
 * Validate a settings payload array. Unknown keys → 400.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeRequiredTaskFields(raw) {
	if (raw == null) {
		throw Object.assign(new Error('requiredTaskFields is required'), {
			status: 400,
		});
	}
	if (!Array.isArray(raw)) {
		throw Object.assign(new Error('requiredTaskFields must be an array'), {
			status: 400,
		});
	}
	const seen = new Set();
	const out = [];
	for (const item of raw) {
		if (typeof item !== 'string' || !item.trim()) {
			throw Object.assign(
				new Error('Each required field key must be a string'),
				{ status: 400 },
			);
		}
		const key = item.trim();
		if (!REQUIRED_TASK_FIELD_SET.has(key)) {
			throw Object.assign(new Error(`Unknown required field: ${key}`), {
				status: 400,
			});
		}
		if (!seen.has(key)) {
			seen.add(key);
			out.push(key);
		}
	}
	return out;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isBlankText(value) {
	if (value == null) return true;
	return String(value).trim().length === 0;
}

/**
 * Empty string or editor-empty HTML (`<p></p>`, etc.).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBlankTaskDesc(value) {
	if (isBlankText(value)) return true;
	const stripped = String(value)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return stripped.length === 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyIdList(value) {
	return !Array.isArray(value) || value.length === 0;
}

/**
 * @typedef {{
 *   externalKey?: unknown,
 *   jobTitle?: unknown,
 *   taskDesc?: unknown,
 *   contactIds?: unknown,
 *   destinationAddressName?: unknown,
 *   destinationAddress?: unknown,
 *   destinationBuilding?: unknown,
 *   destinationNotes?: unknown,
 *   afterDateTime?: unknown,
 *   beforeDateTime?: unknown,
 *   crewMemberIds?: unknown,
 * }} RequiredTaskFieldValues
 */

/**
 * @param {RequiredTaskFieldValues} values
 * @param {unknown} keys
 * @param {{ externalKeyLabel?: string | null }} [opts]
 * @returns {string | null}
 */
export function requiredTaskFieldError(values, keys, opts = {}) {
	const required = requiredTaskFieldsFromDb(keys);
	if (required.length === 0) return null;

	const labelOpts = { externalKeyLabel: opts.externalKeyLabel };

	for (const key of required) {
		const label = requiredTaskFieldLabel(key, labelOpts);
		let missing = false;
		switch (key) {
			case REQUIRED_TASK_FIELDS.externalKey:
				missing = isBlankText(values.externalKey);
				break;
			case REQUIRED_TASK_FIELDS.jobTitle:
				missing = isBlankText(values.jobTitle);
				break;
			case REQUIRED_TASK_FIELDS.taskDesc:
				missing = isBlankTaskDesc(values.taskDesc);
				break;
			case REQUIRED_TASK_FIELDS.contacts:
				missing = isEmptyIdList(values.contactIds);
				break;
			case REQUIRED_TASK_FIELDS.destinationName:
				missing = isBlankText(values.destinationAddressName);
				break;
			case REQUIRED_TASK_FIELDS.destinationAddress:
				missing = isBlankText(values.destinationAddress);
				break;
			case REQUIRED_TASK_FIELDS.destinationBuilding:
				missing = isBlankText(values.destinationBuilding);
				break;
			case REQUIRED_TASK_FIELDS.destinationNotes:
				missing = isBlankText(values.destinationNotes);
				break;
			case REQUIRED_TASK_FIELDS.afterDateTime:
				missing = isBlankText(values.afterDateTime);
				break;
			case REQUIRED_TASK_FIELDS.beforeDateTime:
				missing = isBlankText(values.beforeDateTime);
				break;
			case REQUIRED_TASK_FIELDS.crew:
				missing = isEmptyIdList(values.crewMemberIds);
				break;
			default:
				break;
		}
		if (missing) return `${label} is required`;
	}
	return null;
}

/**
 * @param {RequiredTaskFieldValues} values
 * @param {unknown} keys
 * @param {{ externalKeyLabel?: string | null }} [opts]
 */
export function assertRequiredTaskFields(values, keys, opts = {}) {
	const message = requiredTaskFieldError(values, keys, opts);
	if (!message) return;
	throw Object.assign(new Error(message), { status: 400 });
}
