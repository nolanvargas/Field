export interface TaskTypeForPageLabels {
	name: string;
	pluralName?: string;
}

export function taskListPageLabels(
	activeFilters: string[],
	taskTypes: TaskTypeForPageLabels[],
): { mine: string; all: string };
