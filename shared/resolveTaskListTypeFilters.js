/**
 * Resolve which task types to show in task lists.
 * Per-device preference wins; then desktop All Tasks URL param.
 *
 * @param {{
 *   userFilters?: string[];
 *   urlTypeFilters?: string[];
 *   enabledTypeNames?: string[];
 * }} options
 * @returns {string[]}
 */
export function resolveTaskListTypeFilters({
	userFilters = [],
	urlTypeFilters = [],
	enabledTypeNames = [],
} = {}) {
	const enabled = enabledTypeNames.length
		? new Set(enabledTypeNames)
		: null;
	const keep = (names) =>
		enabled ? names.filter((name) => enabled.has(name)) : names;

	if (userFilters.length > 0) return keep(userFilters);
	if (urlTypeFilters.length > 0) return keep(urlTypeFilters);
	return [];
}
