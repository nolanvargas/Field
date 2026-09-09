import { describe, expect, it } from 'vitest';
import {
	STATUS_TRANSITIONS,
	statusTransitionsFor,
} from '../shared/statusTransitions.js';

const ALL_STATUSES = [
	'Unassigned',
	'Assigned',
	'In Progress',
	'Completed',
	'Failed',
	'Undetermined',
	'Cancelled',
];

/** Enforced manual/admin transitions (PATCH /api/tasks/:id/status). */
const EXPECTED: Record<string, string[]> = {
	Unassigned: ['Assigned'],
	Assigned: ['In Progress', 'Failed'],
	'In Progress': ['Completed', 'Failed', 'Undetermined'],
	Completed: ['In Progress', 'Failed', 'Undetermined'],
	Failed: ['Completed', 'Undetermined'],
	Undetermined: ['Completed', 'Failed'],
	Cancelled: [],
};

describe('statusTransitionsFor', () => {
	it('returns the same table for every task type', () => {
		for (const taskType of [
			'Delivery',
			'Install',
			'Removal',
			'Site Survey',
			'Pickup',
			'Other',
			undefined,
		]) {
			expect(statusTransitionsFor(taskType)).toBe(STATUS_TRANSITIONS);
		}
	});
});

describe('STATUS_TRANSITIONS (manual PATCH)', () => {
	it('defines an entry for every status', () => {
		for (const status of ALL_STATUSES) {
			expect(STATUS_TRANSITIONS[status], status).toBeDefined();
		}
	});

	it('matches the enforced table exactly', () => {
		expect(STATUS_TRANSITIONS).toEqual(EXPECTED);
	});

	it('only lists valid statuses as targets', () => {
		for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
			for (const target of targets) {
				expect(ALL_STATUSES, `${from} → ${target}`).toContain(target);
			}
		}
	});

	it('covers every allowed and rejected transition', () => {
		for (const from of ALL_STATUSES) {
			for (const to of ALL_STATUSES) {
				expect(
					STATUS_TRANSITIONS[from].includes(to),
					`${from} → ${to}`,
				).toBe(EXPECTED[from].includes(to));
			}
		}
	});

	it('lets a Failed task move to Completed or Undetermined', () => {
		expect(STATUS_TRANSITIONS.Failed).toEqual(['Completed', 'Undetermined']);
	});

	it('lets an Undetermined task move to Completed or Failed', () => {
		expect(STATUS_TRANSITIONS.Undetermined).toEqual(['Completed', 'Failed']);
	});

	it('lets a completed task reopen to In Progress', () => {
		expect(STATUS_TRANSITIONS.Completed).toEqual([
			'In Progress',
			'Failed',
			'Undetermined',
		]);
	});
});
