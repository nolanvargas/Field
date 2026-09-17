import type { Task } from '../types/task';
import { parseDayKey } from './dayKeys';

export const HOURS_PER_DAY = 24;

/** Hour-of-day label for day-board column headers (0 = 12am … 23 = 11pm). */
export function formatHourLabel(hour: number): string {
	const suffix = hour >= 12 ? 'pm' : 'am';
	let h = hour % 12;
	if (h === 0) h = 12;
	return `${h}${suffix}`;
}

export function hourLabels(): string[] {
	return Array.from({ length: HOURS_PER_DAY }, (_, hour) =>
		formatHourLabel(hour),
	);
}

export type TaskDayBoardSpan = {
	/** 1-based grid column (inclusive). */
	startCol: number;
	/** 1-based grid column (inclusive). */
	endCol: number;
};

function dayBounds(dayKey: string): { start: Date; end: Date } {
	const start = parseDayKey(dayKey);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { start, end };
}

/** Map a task window to hour columns on `dayKey` (clipped to that local day). */
export function taskDayBoardSpan(
	task: Pick<Task, 'windowStartAt' | 'windowEndAt'>,
	dayKey: string,
): TaskDayBoardSpan | null {
	const { start: dayStart, end: dayEnd } = dayBounds(dayKey);

	if (!task.windowStartAt) return null;
	const rawStart = new Date(task.windowStartAt);
	if (Number.isNaN(rawStart.getTime())) return null;

	let rawEnd = task.windowEndAt ? new Date(task.windowEndAt) : null;
	if (!rawEnd || Number.isNaN(rawEnd.getTime())) {
		rawEnd = new Date(rawStart);
		rawEnd.setHours(rawEnd.getHours() + 1);
	}

	const clipStart = rawStart < dayStart ? dayStart : rawStart;
	const clipEnd = rawEnd > dayEnd ? dayEnd : rawEnd;

	if (clipEnd <= clipStart) {
		const hour = Math.min(23, Math.max(0, clipStart.getHours()));
		return { startCol: hour + 1, endCol: hour + 1 };
	}

	const startHour = clipStart.getHours();
	let endHour: number;

	if (clipEnd.getTime() >= dayEnd.getTime()) {
		endHour = 23;
	} else {
		endHour = clipEnd.getHours();
		const onHourBoundary =
			clipEnd.getMinutes() === 0 &&
			clipEnd.getSeconds() === 0 &&
			clipEnd.getMilliseconds() === 0;
		if (onHourBoundary && clipEnd > clipStart) {
			endHour -= 1;
		}
	}

	endHour = Math.max(startHour, endHour);
	return { startCol: startHour + 1, endCol: endHour + 1 };
}

export function sortTasksForDayBoard(tasks: readonly Task[]): Task[] {
	return [...tasks].sort((a, b) => {
		const aMs = a.windowStartAt ? new Date(a.windowStartAt).getTime() : Infinity;
		const bMs = b.windowStartAt ? new Date(b.windowStartAt).getTime() : Infinity;
		if (aMs !== bMs) return aMs - bMs;
		return a.id - b.id;
	});
}
