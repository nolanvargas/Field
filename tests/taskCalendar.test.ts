import { describe, expect, it } from 'vitest';
import {
	bucketTasksByDay,
	dayMetrics,
	dayStatusCounts,
	dayTypeCounts,
} from '../src/taskCalendar/bucketTasks';
import {
	formatHourLabel,
	hourLabels,
	sortTasksForDayBoard,
	taskDayBoardSpan,
} from '../src/taskCalendar/dayBoard';
import { filterTasksToListView } from '../src/taskCalendar/filterTasksToListView';
import {
	addDays,
	addMonths,
	calendarYearOptions,
	localDayKey,
	monthGridDays,
	parseDayKey,
	startOfWeek,
	weekDayKeys,
	withMonth,
	withYear,
} from '../src/taskCalendar/dayKeys';
import {
	heatmapCellBackground,
	heatmapCellContrastVars,
	heatmapDisplayLevel,
	heatmapLevel,
	heatmapMinMax,
} from '../src/taskCalendar/heatmap';
import type { Task } from '../src/types/task';

function makeTask(
	id: number,
	windowStartAt: string | null,
	status: Task['status'] = 'Assigned',
	taskType: Task['taskType'] = 'Delivery',
): Task {
	return {
		id,
		taskType,
		status,
		externalKey: `JOB-${id}`,
		jobTitle: `Task ${id}`,
		contactNames: '',
		destinationAddressName: '',
		destinationStreet: '',
		destinationBuilding: '',
		destinationAddress: '',
		crewName: null,
		windowStartAt,
		windowEndAt: null,
		description: '',
		createdByName: '',
		cancelledAt: null,
	};
}

describe('monthGridDays', () => {
	it('returns 42 cells for September 2026', () => {
		const cells = monthGridDays('2026-09-15');
		expect(cells).toHaveLength(42);
		const inMonth = cells.filter((c) => c.inMonth);
		expect(inMonth).toHaveLength(30);
		expect(inMonth[0].key).toBe('2026-09-01');
		expect(inMonth[inMonth.length - 1].key).toBe('2026-09-30');
	});

	it('marks padding days outside the month', () => {
		const cells = monthGridDays('2026-09-01');
		const first = cells[0];
		expect(first.inMonth).toBe(false);
		expect(first.key).toBe('2026-08-30');
	});
});

describe('weekDayKeys', () => {
	it('returns 7 keys starting Sunday', () => {
		const keys = weekDayKeys(startOfWeek('2026-09-15'));
		expect(keys).toHaveLength(7);
		expect(keys[0]).toBe('2026-09-13');
		expect(keys[6]).toBe('2026-09-19');
	});
});

describe('addDays / addMonths', () => {
	it('adds days across month boundary', () => {
		expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
	});

	it('adds months', () => {
		expect(addMonths('2026-09-15', 1)).toBe('2026-10-15');
	});
});

describe('withMonth / withYear', () => {
	it('keeps the day when the target month has it', () => {
		expect(withMonth('2026-09-15', 2)).toBe('2026-03-15');
		expect(withYear('2026-09-15', 2027)).toBe('2027-09-15');
	});

	it('clamps the day when the target month is shorter', () => {
		expect(withMonth('2026-01-31', 1)).toBe('2026-02-28');
		expect(withYear('2024-02-29', 2025)).toBe('2025-02-28');
	});
});

describe('calendarYearOptions', () => {
	it('starts at current year + 1 and stops at 2026', () => {
		const years = calendarYearOptions(new Date(2026, 8, 6));
		expect(years).toEqual([2027, 2026]);
	});

	it('does not include years before 2026', () => {
		const years = calendarYearOptions(new Date(2026, 8, 6), 2020);
		expect(years).toEqual([2027, 2026]);
	});

	it('extends the range to include a later year', () => {
		const years = calendarYearOptions(new Date(2026, 8, 6), 2030);
		expect(years[0]).toBe(2030);
		expect(years).toContain(2027);
		expect(years.at(-1)).toBe(2026);
	});
});

describe('filterTasksToListView', () => {
	it('keeps only tasks in the focused week', () => {
		const tasks = [
			makeTask(1, '2026-10-04T10:00:00', 'In Progress'),
			makeTask(2, '2026-10-10T10:00:00', 'Completed'),
			makeTask(3, '2026-10-11T10:00:00', 'Assigned'),
		];
		const filtered = filterTasksToListView(tasks, 'week', '2026-10-06');
		expect(filtered.map((task) => task.id)).toEqual([1, 2]);
	});

	it('keeps only tasks on the visible month grid', () => {
		const tasks = [
			makeTask(1, '2026-08-30T10:00:00', 'Assigned'),
			makeTask(2, '2026-09-15T10:00:00', 'In Progress'),
			makeTask(3, '2026-11-01T10:00:00', 'Completed'),
		];
		const filtered = filterTasksToListView(tasks, 'month', '2026-09-15');
		expect(filtered.map((task) => task.id)).toEqual([1, 2]);
	});

	it('returns all tasks for list view', () => {
		const tasks = [
			makeTask(1, '2026-10-04T10:00:00'),
			makeTask(2, '2026-11-01T10:00:00'),
		];
		expect(filterTasksToListView(tasks, 'list', '2026-10-06')).toEqual(tasks);
	});
});

describe('bucketTasksByDay', () => {
	it('groups tasks by windowStartAt local day', () => {
		const tasks = [
			makeTask(1, '2026-09-15T10:00:00'),
			makeTask(2, '2026-09-15T18:00:00'),
			makeTask(3, '2026-09-16T08:00:00'),
			makeTask(4, null),
		];
		const map = bucketTasksByDay(tasks);
		expect(map.get('2026-09-15')).toHaveLength(2);
		expect(map.get('2026-09-16')).toHaveLength(1);
		expect(map.has('2026-09-17')).toBe(false);
	});
});

describe('dayMetrics', () => {
	it('counts total and in-progress', () => {
		const tasks = [
			makeTask(1, '2026-09-15T10:00:00', 'In Progress'),
			makeTask(2, '2026-09-15T18:00:00', 'Assigned'),
			makeTask(3, '2026-09-16T08:00:00', 'In Progress'),
		];
		expect(dayMetrics(tasks)).toEqual({ total: 3, inProgress: 2 });
	});
});

describe('heatmapLevel', () => {
	it('returns 0 for zero count', () => {
		expect(heatmapLevel(0, 1, 5)).toBe(0);
	});

	it('returns 1 when all counts equal max', () => {
		expect(heatmapLevel(3, 3, 3)).toBe(1);
	});

	it('interpolates between min and max', () => {
		expect(heatmapLevel(3, 1, 5)).toBe(0.5);
	});
});

describe('heatmapMinMax', () => {
	it('ignores outside-month cells', () => {
		const counts = [0, 2, 5, 1];
		const inMonth = [false, true, true, false];
		expect(heatmapMinMax(counts, inMonth)).toEqual({ min: 2, max: 5 });
	});
});

describe('heatmapCellContrastVars', () => {
	it('picks dark text on light heat backgrounds', () => {
		const vars = heatmapCellContrastVars(0.18, '#c49ac5', '#fafafa');
		expect(vars['--task-cell-fg']).toBe('#111111');
	});

	it('picks light text on saturated heat backgrounds', () => {
		const vars = heatmapCellContrastVars(1, '#732e75', '#fafafa');
		expect(vars['--task-cell-fg']).toBe('#eeeeee');
	});

	it('matches the css color-mix background blend', () => {
		expect(heatmapCellBackground(0.5, '#c49ac5', '#fafafa')).toBe('#dfcae0');
	});
});

describe('heatmapDisplayLevel', () => {
	it('returns 0 for zero count', () => {
		expect(heatmapDisplayLevel(0, 1, 5)).toBe(0);
	});

	it('applies a floor when count equals month minimum', () => {
		expect(heatmapDisplayLevel(12, 12, 22)).toBeGreaterThan(0);
		expect(heatmapDisplayLevel(12, 12, 22)).toBe(0.18);
	});

	it('returns 1 at month maximum', () => {
		expect(heatmapDisplayLevel(22, 12, 22)).toBe(1);
	});
});

describe('dayTypeCounts', () => {
	it('counts per type and sorts by org order', () => {
		const tasks = [
			makeTask(1, '2026-09-15T10:00:00', 'Assigned', 'Pickup'),
			makeTask(2, '2026-09-15T18:00:00', 'Assigned', 'Delivery'),
			makeTask(3, '2026-09-15T08:00:00', 'Assigned', 'Delivery'),
		];
		expect(dayTypeCounts(tasks, ['Delivery', 'Pickup', 'Install'])).toEqual([
			{ typeName: 'Delivery', count: 2 },
			{ typeName: 'Pickup', count: 1 },
		]);
	});

	it('omits types with zero count', () => {
		const tasks = [makeTask(1, '2026-09-15T10:00:00')];
		expect(dayTypeCounts(tasks, ['Delivery', 'Pickup'])).toEqual([
			{ typeName: 'Delivery', count: 1 },
		]);
	});

	it('returns empty for no tasks', () => {
		expect(dayTypeCounts([], ['Delivery'])).toEqual([]);
	});
});

describe('dayStatusCounts', () => {
	it('counts per status and sorts by canonical order', () => {
		const tasks = [
			makeTask(1, '2026-09-15T10:00:00', 'Completed'),
			makeTask(2, '2026-09-15T18:00:00', 'Assigned'),
			makeTask(3, '2026-09-15T08:00:00', 'In Progress'),
			makeTask(4, '2026-09-15T09:00:00', 'Assigned'),
		];
		expect(dayStatusCounts(tasks)).toEqual([
			{ status: 'Assigned', count: 2 },
			{ status: 'In Progress', count: 1 },
			{ status: 'Completed', count: 1 },
		]);
	});

	it('omits statuses with zero count', () => {
		const tasks = [makeTask(1, '2026-09-15T10:00:00', 'Failed')];
		expect(dayStatusCounts(tasks)).toEqual([{ status: 'Failed', count: 1 }]);
	});

	it('returns empty for no tasks', () => {
		expect(dayStatusCounts([])).toEqual([]);
	});
});

describe('dayBoard', () => {
	it('formats hour labels from 12am through 11pm', () => {
		expect(hourLabels()).toHaveLength(24);
		expect(formatHourLabel(0)).toBe('12am');
		expect(formatHourLabel(12)).toBe('12pm');
		expect(formatHourLabel(23)).toBe('11pm');
	});

	it('maps a task window to hour columns on the focus day', () => {
		const span = taskDayBoardSpan(
			{
				windowStartAt: '2026-09-15T10:30:00',
				windowEndAt: '2026-09-15T14:00:00',
			},
			'2026-09-15',
		);
		expect(span).toEqual({ startCol: 11, endCol: 14 });
	});

	it('spans a single hour for an exact one-hour window', () => {
		const span = taskDayBoardSpan(
			{
				windowStartAt: '2026-09-15T10:00:00',
				windowEndAt: '2026-09-15T11:00:00',
			},
			'2026-09-15',
		);
		expect(span).toEqual({ startCol: 11, endCol: 11 });
	});

	it('clips tasks that run past midnight to the last hour column', () => {
		const span = taskDayBoardSpan(
			{
				windowStartAt: '2026-09-15T22:00:00',
				windowEndAt: '2026-09-16T02:00:00',
			},
			'2026-09-15',
		);
		expect(span).toEqual({ startCol: 23, endCol: 24 });
	});

	it('sorts tasks by window start time', () => {
		const tasks = [
			makeTask(2, '2026-09-15T14:00:00'),
			makeTask(1, '2026-09-15T09:00:00'),
		];
		expect(sortTasksForDayBoard(tasks).map((task) => task.id)).toEqual([1, 2]);
	});
});

describe('localDayKey / parseDayKey', () => {
	it('round-trips', () => {
		const d = new Date(2026, 8, 15);
		const key = localDayKey(d);
		expect(key).toBe('2026-09-15');
		expect(parseDayKey(key).getDate()).toBe(15);
	});
});
