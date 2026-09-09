/**
 * Parse and format boolean cells for user permission columns.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function parseBooleanCell(value) {
	if (value == null) return false;
	const s = String(value).trim();
	if (!s) return false;
	const upper = s.toUpperCase();
	if (upper === 'TRUE' || upper === 'T' || upper === 'Y' || upper === 'YES') {
		return true;
	}
	if (
		upper === 'FALSE' ||
		upper === 'F' ||
		upper === 'N' ||
		upper === 'NO'
	) {
		return false;
	}
	throw new Error(
		`Expected TRUE/FALSE (or T/F, Y/N), got "${s}"`,
	);
}

/**
 * @param {boolean} value
 * @returns {'TRUE' | 'FALSE'}
 */
export function formatBooleanCell(value) {
	return value ? 'TRUE' : 'FALSE';
}
