import { describe, expect, it } from 'vitest';
import {
	buildCrewPushPayload,
	crewPushIdsPerUser,
	taskScheduleChanged,
} from '../shared/crewPushNotifications.js';

describe('crewPushIdsPerUser', () => {
	it('prioritizes unassigned over schedule for removed crew', () => {
		const map = crewPushIdsPerUser({
			prevCrewIds: ['a', 'b'],
			nextCrewIds: ['b'],
			scheduleChanged: true,
			crewCompositionChanged: true,
		});
		expect(map.get('a')).toBe('task_unassigned');
		expect(map.get('b')).toBe('schedule_changed');
	});

	it('notifies new crew as assigned', () => {
		const map = crewPushIdsPerUser({
			prevCrewIds: ['a'],
			nextCrewIds: ['a', 'b'],
			scheduleChanged: false,
			crewCompositionChanged: true,
		});
		expect(map.get('b')).toBe('task_assigned');
	});
});

describe('buildCrewPushPayload', () => {
	it('builds cancel copy with day deep link', () => {
		const { title, body, data } = buildCrewPushPayload({
			notificationId: 'task_cancelled',
			taskId: 99440,
			externalKey: '99440',
			windowStartAt: '2026-07-29T17:00:00.000Z',
			destinationName: 'COSMO',
			destinationAddress: 'Cosmopolitan',
		});
		expect(title).toContain('99440');
		expect(body).toContain('Task cancelled');
		expect(body).toContain('COSMO');
		expect(data.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('taskScheduleChanged', () => {
	it('detects window start changes', () => {
		expect(
			taskScheduleChanged(
				'2026-07-29T10:00:00.000Z',
				'2026-07-29T10:30:00.000Z',
				null,
				null,
			),
		).toBe(true);
	});
});
