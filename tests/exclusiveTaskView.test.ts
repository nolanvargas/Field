import { describe, expect, it } from 'vitest';
import { exclusiveTaskAction } from '../src/exclusiveTaskView';

describe('exclusiveTaskAction', () => {
	it('opens the mobile task page when the compact task UI is on', () => {
		expect(exclusiveTaskAction(42, true)).toEqual({
			kind: 'page',
			path: '/task/42',
		});
	});

	it('opens the desktop modal when the compact task UI is off', () => {
		expect(exclusiveTaskAction(42, false)).toEqual({
			kind: 'modal',
			taskId: 42,
		});
	});
});
