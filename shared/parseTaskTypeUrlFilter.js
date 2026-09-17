/**
 * Parse desktop All Tasks `type` search param (single or comma-separated).
 *
 * @param {string | null} raw
 * @param {readonly string[]} allowed
 * @returns {string[]}
 */
export function parseTaskTypeUrlFilter(raw, allowed) {
	if (!raw || raw === 'all') return [];
	const enabled = new Set(allowed);
	const names = [];
	for (const piece of String(raw).split(',')) {
		const name = piece.trim();
		if (name && name !== 'all' && enabled.has(name)) {
			names.push(name);
		}
	}
	return [...new Set(names)];
}

/**
 * @param {string[]} filters
 * @returns {string | null} null = omit param (show all types)
 */
export function serializeTaskTypeUrlFilter(filters) {
	const unique = filters.filter(
		(value, index, array) => value && array.indexOf(value) === index,
	);
	if (unique.length === 0) return null;
	return unique.join(',');
}
