import type { Task, TaskStatus } from '../types/task';
import { dayKeyFromIso } from './dayKeys';

const STATUS_ORDER: TaskStatus[] = [
	'Unassigned',
	'Assigned',
	'In Progress',
	'Completed',
	'Failed',
	'Undetermined',
	'Cancelled',
];

export type DayMetrics = {
	total: number;
	inProgress: number;
};

export type DayTypeCount = {
	typeName: string;
	count: number;
};

export type DayStatusCount = {
	status: TaskStatus;
	count: number;
};

export function bucketTasksByDay(tasks: readonly Task[]): Map<string, Task[]> {
	const map = new Map<string, Task[]>();
	for (const task of tasks) {
		const key = dayKeyFromIso(task.windowStartAt);
		if (!key) continue;
		const list = map.get(key);
		if (list) {
			list.push(task);
		} else {
			map.set(key, [task]);
		}
	}
	return map;
}

export function dayMetrics(tasks: readonly Task[]): DayMetrics {
	let inProgress = 0;
	for (const task of tasks) {
		if (task.status === 'In Progress') inProgress += 1;
	}
	return { total: tasks.length, inProgress };
}

/** Per-type counts for one day, ordered by `typeOrder` then alpha for unknown types. */
export function dayTypeCounts(
	tasks: readonly Task[],
	typeOrder: readonly string[],
): DayTypeCount[] {
	const counts = new Map<string, number>();
	for (const task of tasks) {
		counts.set(task.taskType, (counts.get(task.taskType) ?? 0) + 1);
	}
	if (counts.size === 0) return [];

	const orderIndex = new Map(typeOrder.map((name, i) => [name, i]));
	const sorted = [...counts.entries()].sort(([a], [b]) => {
		const ai = orderIndex.get(a);
		const bi = orderIndex.get(b);
		if (ai != null && bi != null) return ai - bi;
		if (ai != null) return -1;
		if (bi != null) return 1;
		return a.localeCompare(b);
	});

	return sorted.map(([typeName, count]) => ({ typeName, count }));
}

/** Per-status counts for one day, ordered by canonical status order. */
export function dayStatusCounts(tasks: readonly Task[]): DayStatusCount[] {
	const counts = new Map<TaskStatus, number>();
	for (const task of tasks) {
		counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
	}
	if (counts.size === 0) return [];

	return STATUS_ORDER
		.filter((status) => (counts.get(status) ?? 0) > 0)
		.map((status) => ({ status, count: counts.get(status)! }));
}
