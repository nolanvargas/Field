/**
 * Resolve which task types to show in task lists.
 * Per-device preference wins; then desktop All Tasks URL param.
 *
 * @param {{
 *   userFilters?: string[];
 *   urlTypeFilter?: 'all' | string;
 *   enabledTypeNames?: string[];
 * }} options
 * @returns {string[]}
 */
export function resolveTaskListTypeFilters({
	userFilters = [],
	urlTypeFilter = 'all',
	enabledTypeNames = [],
} = {}) {
	const enabled = enabledTypeNames.length
		? new Set(enabledTypeNames)
		: null;
	const keep = (names) =>
		enabled ? names.filter((name) => enabled.has(name)) : names;

	if (userFilters.length > 0) return keep(userFilters);
	if (urlTypeFilter && urlTypeFilter !== 'all') {
		const name = String(urlTypeFilter);
		if (!enabled || enabled.has(name)) return [name];
	}
	return [];
}
