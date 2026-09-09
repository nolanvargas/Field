/**
 * Reserved sentinel for required custom fields left blank by a bulk import.
 *
 * Imports never reject a row for a missing custom field, but a required field
 * cannot be silently omitted either — that would look like a deliberate empty
 * value. Instead the slot stores this token, which is never shown to users:
 * displays render a dimmed "undefined", exports emit a blank cell, and
 * interactive save still demands a real value.
 *
 * The token is deliberately not a plausible user value (`false`, `-1`, and `—`
 * all are), and it is rejected as input on interactive create/edit.
 */

export const CUSTOM_FIELD_IMPORT_PLACEHOLDER = '__field_import_unset__';

/** User-facing stand-in for a placeholder value. Render dimmed. */
export const CUSTOM_FIELD_UNDEFINED_DISPLAY = 'undefined';

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCustomFieldImportPlaceholder(value) {
	if (value === CUSTOM_FIELD_IMPORT_PLACEHOLDER) return true;
	return (
		Array.isArray(value) &&
		value.length === 1 &&
		value[0] === CUSTOM_FIELD_IMPORT_PLACEHOLDER
	);
}

/**
 * Drop placeholder slots so callers see a genuinely empty value (exports, CSV).
 * @param {Record<string, unknown> | null | undefined} values
 * @returns {Record<string, unknown>}
 */
export function stripCustomFieldImportPlaceholders(values) {
	if (!values || typeof values !== 'object') return {};
	/** @type {Record<string, unknown>} */
	const out = {};
	for (const [slot, value] of Object.entries(values)) {
		if (isCustomFieldImportPlaceholder(value)) continue;
		out[slot] = value;
	}
	return out;
}
