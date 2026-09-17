import {
	dayStatusCounts,
	dayTypeCounts,
	type DayStatusCount,
	type DayTypeCount,
} from '../taskCalendar/bucketTasks';
import { formatPickedDayLabel } from '../taskCalendar/dayKeys';
import type { Task } from '../types/task';

export type TaskWeekDayTooltipData = {
	dayLabel: string;
	total: number;
	typeCounts: DayTypeCount[];
	statusCounts: DayStatusCount[];
};

export function taskWeekDayTotalLabel(total: number): string {
	if (total === 0) return 'No tasks';
	if (total === 1) return '1 task';
	return `${total} tasks`;
}

export function buildTaskWeekDayTooltipData(
	dayKey: string,
	tasks: readonly Task[],
	typeOrder: readonly string[],
): TaskWeekDayTooltipData {
	return {
		dayLabel: formatPickedDayLabel(dayKey),
		total: tasks.length,
		typeCounts: dayTypeCounts(tasks, typeOrder),
		statusCounts: dayStatusCounts(tasks),
	};
}
