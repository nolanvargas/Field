import { describe, expect, it } from 'vitest';
import { pathForNotification } from '../src/notifications/notificationDeepLinks';

describe('pathForNotification', () => {
	it('routes task_assigned to the task view', () => {
		expect(
			pathForNotification({ notificationId: 'task_assigned', taskId: 42 }),
		).toBe('/task/42');
	});

	it('returns null when task view notifications lack a task id', () => {
		expect(
			pathForNotification({ notificationId: 'task_assigned' }),
		).toBeNull();
		expect(
			pathForNotification({ notificationId: 'schedule_changed', taskId: NaN }),
		).toBeNull();
	});

	it('routes task_unassigned with a valid day to my-tasks filtered by day', () => {
		expect(
			pathForNotification({
				notificationId: 'task_unassigned',
				day: '2026-09-02',
			}),
		).toBe('/my-tasks?day=2026-09-02');
	});

	it('falls back to my-tasks when day is missing or invalid', () => {
		expect(
			pathForNotification({ notificationId: 'task_unassigned' }),
		).toBe('/my-tasks');
		expect(
			pathForNotification({
				notificationId: 'task_cancelled',
				day: 'not-a-date',
			}),
		).toBe('/my-tasks');
	});

	it('returns null for unknown notification ids', () => {
		expect(
			pathForNotification({ notificationId: 'something_else', taskId: 1 }),
		).toBeNull();
	});
});
