/**
 * Spreadsheet address columns → single addresses.street_line on import.
 */

/**
 * @param {string | null | undefined} value
 */
function trim(value) {
	return String(value ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * @param {{
 *   street?: string | null,
 *   city?: string | null,
 *   state?: string | null,
 *   postalCode?: string | null,
 * }} parts
 * @returns {string}
 */
export function formatStreetLineFromImportParts(parts) {
	const street = trim(parts.street);
	const city = trim(parts.city);
	const state = trim(parts.state);
	const postalCode = trim(parts.postalCode);

	const statePostal = [state, postalCode].filter(Boolean).join(' ');
	const cityStatePostal = [city, statePostal].filter(Boolean).join(', ');

	return [street, cityStatePostal].filter(Boolean).join(', ');
}
