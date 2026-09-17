import { describe, expect, it } from 'vitest';
import { taskWeekTooltipRows } from '../src/components/TaskWeekTaskTooltip';
import type { Task } from '../src/types/task';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 1,
		taskType: 'Delivery',
		status: 'Assigned',
		externalKey: 'JOB-1',
		jobTitle: 'Install',
		contactNames: 'Jane Doe',
		destinationAddressName: '742 Evergreen Terrace',
		destinationStreet: '',
		destinationBuilding: '',
		destinationAddress: '742 Evergreen Terrace, Springfield',
		crewName: 'Omar Ortiz, Ada Lovelace',
		windowStartAt: '2026-09-15T14:00:00.000Z',
		windowEndAt: '2026-09-15T16:00:00.000Z',
		description: '<p>Ring bell</p>',
		createdByName: 'Creator',
		cancelledAt: null,
		...overrides,
	};
}

describe('taskWeekTooltipRows', () => {
	it('includes location, window, and crew rows', () => {
		const rows = taskWeekTooltipRows(makeTask());
		expect(rows.map((row) => row.label)).toEqual([
			'Location',
			'Window',
			'Crew',
		]);
		expect(rows[0]?.value).toBe('742 Evergreen Terrace');
		expect(rows.some((row) => row.label === 'Window')).toBe(true);
		expect(rows[2]?.value).toBe('Omar O., Ada L.');
	});

	it('omits crew row when unassigned', () => {
		const rows = taskWeekTooltipRows(makeTask({ crewName: null }));
		expect(rows.some((row) => row.label === 'Crew')).toBe(false);
	});

	it('omits location row when address name is blank', () => {
		const rows = taskWeekTooltipRows(
			makeTask({ destinationAddressName: '   ' }),
		);
		expect(rows.some((row) => row.label === 'Location')).toBe(false);
	});
});
