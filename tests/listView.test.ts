import { describe, expect, it } from 'vitest';
import {
	TASK_LIST_VIEWS,
	isTaskListView,
	type TaskListView,
} from '../src/taskCalendar/listView';

describe('isTaskListView', () => {
	it('accepts month, week, day, and list', () => {
		for (const view of TASK_LIST_VIEWS) {
			expect(isTaskListView(view)).toBe(true);
		}
	});

	it('rejects unknown values', () => {
		expect(isTaskListView('year')).toBe(false);
		expect(isTaskListView('')).toBe(false);
		expect(isTaskListView('MONTH')).toBe(false);
	});

	it('narrows valid strings to TaskListView', () => {
		const value = 'week';
		if (isTaskListView(value)) {
			const view: TaskListView = value;
			expect(view).toBe('week');
		} else {
			throw new Error('expected week to be a valid view');
		}
	});
});
