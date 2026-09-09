import { describe, expect, it } from 'vitest';
import { bucketTasksByDay, dayMetrics } from '../src/taskCalendar/bucketTasks';
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
import { heatmapLevel, heatmapMinMax } from '../src/taskCalendar/heatmap';
import type { Task } from '../src/types/task';

function makeTask(
	id: number,
	windowStartAt: string | null,
	status: Task['status'] = 'Assigned',
): Task {
	return {
		id,
		taskType: 'Delivery',
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

describe('localDayKey / parseDayKey', () => {
	it('round-trips', () => {
		const d = new Date(2026, 8, 15);
		const key = localDayKey(d);
		expect(key).toBe('2026-09-15');
		expect(parseDayKey(key).getDate()).toBe(15);
	});
});
