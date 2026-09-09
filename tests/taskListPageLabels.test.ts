import { describe, expect, it } from 'vitest';
import { taskListPageLabels } from '../shared/taskListPageLabels.js';

const taskTypes = [
	{ name: 'Delivery', pluralName: 'Deliveries' },
	{ name: 'Install', pluralName: 'Installs' },
	{ name: 'Test', pluralName: 'Tests' },
	{ name: 'Custom', pluralName: '' },
];

describe('taskListPageLabels', () => {
	it('returns default titles when no filter is set', () => {
		expect(taskListPageLabels([], taskTypes)).toEqual({
			mine: 'My Tasks',
			all: 'All Tasks',
		});
	});

	it('uses plural name when exactly one type is filtered', () => {
		expect(taskListPageLabels(['Delivery'], taskTypes)).toEqual({
			mine: 'My Deliveries',
			all: 'All Deliveries',
		});
	});

	it('falls back to Tasks when the sole filter type has no plural name', () => {
		expect(taskListPageLabels(['Custom'], taskTypes)).toEqual({
			mine: 'My Tasks',
			all: 'All Tasks',
		});
	});

	it('returns default titles when two or more types are filtered', () => {
		expect(taskListPageLabels(['Delivery', 'Install'], taskTypes)).toEqual({
			mine: 'My Tasks',
			all: 'All Tasks',
		});
	});
});
