/**
 * @param {string[]} activeFilters - org default filter (empty = all types)
 * @param {{ name: string, pluralName?: string }[]} taskTypes
 * @returns {{ mine: string, all: string }}
 */
export function taskListPageLabels(activeFilters, taskTypes) {
	const defaults = { mine: 'My Tasks', all: 'All Tasks' };
	if (!activeFilters?.length || activeFilters.length > 1) return defaults;
	const match = taskTypes.find((t) => t.name === activeFilters[0]);
	const plural = match?.pluralName?.trim();
	if (!plural) return defaults;
	return { mine: `My ${plural}`, all: `All ${plural}` };
}
