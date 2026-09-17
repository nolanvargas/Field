import { describe, expect, it } from 'vitest';
import {
	buildTaskWeekDayTooltipData,
	taskWeekDayTotalLabel,
} from '../src/components/taskWeekDayTooltip';
import type { Task } from '../src/types/task';

function makeTask(
	id: number,
	taskType: Task['taskType'] = 'Delivery',
	status: Task['status'] = 'Assigned',
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
		windowStartAt: '2026-09-09T10:00:00.000Z',
		windowEndAt: null,
		description: '',
		createdByName: '',
		cancelledAt: null,
	};
}

describe('taskWeekDayTotalLabel', () => {
	it('formats empty, singular, and plural totals', () => {
		expect(taskWeekDayTotalLabel(0)).toBe('No tasks');
		expect(taskWeekDayTotalLabel(1)).toBe('1 task');
		expect(taskWeekDayTotalLabel(5)).toBe('5 tasks');
	});
});

describe('buildTaskWeekDayTooltipData', () => {
	it('builds type and status panes for mixed tasks', () => {
		const tasks = [
			makeTask(1, 'Delivery', 'In Progress'),
			makeTask(2, 'Delivery', 'Assigned'),
			makeTask(3, 'Pickup', 'Assigned'),
		];
		const data = buildTaskWeekDayTooltipData(
			'2026-09-09',
			tasks,
			['Delivery', 'Pickup'],
		);

		expect(data.dayLabel).toBe('Wed Sep 9');
		expect(data.total).toBe(3);
		expect(data.typeCounts).toEqual([
			{ typeName: 'Delivery', count: 2 },
			{ typeName: 'Pickup', count: 1 },
		]);
		expect(data.statusCounts).toEqual([
			{ status: 'Assigned', count: 2 },
			{ status: 'In Progress', count: 1 },
		]);
	});

	it('returns empty panes for a day with no tasks', () => {
		const data = buildTaskWeekDayTooltipData('2026-09-09', [], ['Delivery']);
		expect(data.total).toBe(0);
		expect(data.typeCounts).toEqual([]);
		expect(data.statusCounts).toEqual([]);
	});
});
