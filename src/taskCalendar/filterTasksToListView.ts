import type { Task } from '../types/task';
import { dayKeyFromIso, monthGridDays, startOfWeek, weekDayKeys } from './dayKeys';
import type { TaskListView } from './listView';

export function dayKeysForListView(
	listView: TaskListView,
	focusDayKey: string,
): Set<string> | null {
	if (listView === 'week') {
		return new Set(weekDayKeys(startOfWeek(focusDayKey)));
	}
	if (listView === 'month') {
		return new Set(monthGridDays(focusDayKey).map((cell) => cell.key));
	}
	return null;
}

/** Keep tasks whose window start falls on a day visible in week/month calendar views. */
export function filterTasksToListView(
	tasks: readonly Task[],
	listView: TaskListView,
	focusDayKey: string,
): Task[] {
	const keys = dayKeysForListView(listView, focusDayKey);
	if (!keys) return [...tasks];
	return tasks.filter((task) => {
		const key = dayKeyFromIso(task.windowStartAt);
		return key != null && keys.has(key);
	});
}
