import type { Task } from '../types/task';
import { dayKeyFromIso } from './dayKeys';

export type DayMetrics = {
	total: number;
	inProgress: number;
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
