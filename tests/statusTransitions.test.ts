import { describe, expect, it } from 'vitest';
import {
	DELIVERY_STATUS_TRANSITIONS,
	STATUS_TRANSITIONS,
	statusTransitionsFor,
} from '../shared/statusTransitions.js';

const ALL_STATUSES = [
	'Unassigned',
	'Assigned',
	'Loaded',
	'In Progress',
	'Completed',
	'Failed',
	'Undetermined',
	'Cancelled',
];

/** Enforced manual/admin transitions for non-Delivery tasks (PATCH /api/tasks/:id/status). */
const EXPECTED_NON_DELIVERY: Record<string, string[]> = {
	Unassigned: ['Assigned'],
	Assigned: ['Loaded', 'In Progress', 'Failed'],
	Loaded: ['In Progress', 'Failed'],
	'In Progress': ['Completed', 'Failed', 'Undetermined'],
	Completed: ['In Progress', 'Failed', 'Undetermined'],
	Failed: ['Completed', 'Undetermined'],
	Undetermined: ['Completed', 'Failed'],
	Cancelled: [],
};

/** Enforced manual/admin transitions for Delivery tasks (Loaded is the active-work status). */
const EXPECTED_DELIVERY: Record<string, string[]> = {
	Unassigned: ['Assigned'],
	Assigned: ['Loaded', 'Failed'],
	Loaded: ['Completed', 'Failed', 'Undetermined'],
	'In Progress': ['Completed', 'Failed', 'Undetermined'],
	Completed: ['Loaded'],
	Failed: [],
	Undetermined: [],
	Cancelled: [],
};

describe('statusTransitionsFor', () => {
	it('selects the Delivery table only for Delivery tasks', () => {
		expect(statusTransitionsFor('Delivery')).toBe(DELIVERY_STATUS_TRANSITIONS);
		for (const taskType of [
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

describe('STATUS_TRANSITIONS (non-Delivery manual PATCH)', () => {
	it('defines an entry for every status', () => {
		for (const status of ALL_STATUSES) {
			expect(STATUS_TRANSITIONS[status], status).toBeDefined();
		}
	});

	it('matches the enforced table exactly', () => {
		expect(STATUS_TRANSITIONS).toEqual(EXPECTED_NON_DELIVERY);
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
				).toBe(EXPECTED_NON_DELIVERY[from].includes(to));
			}
		}
	});

	it('lets a non-Delivery Failed task move to Completed or Undetermined', () => {
		expect(STATUS_TRANSITIONS.Failed).toEqual(['Completed', 'Undetermined']);
	});

	it('lets a non-Delivery Undetermined task move to Completed or Failed', () => {
		expect(STATUS_TRANSITIONS.Undetermined).toEqual(['Completed', 'Failed']);
	});
});

describe('DELIVERY_STATUS_TRANSITIONS (Delivery manual PATCH)', () => {
	it('defines an entry for every status', () => {
		for (const status of ALL_STATUSES) {
			expect(DELIVERY_STATUS_TRANSITIONS[status], status).toBeDefined();
		}
	});

	it('matches the enforced table exactly', () => {
		expect(DELIVERY_STATUS_TRANSITIONS).toEqual(EXPECTED_DELIVERY);
	});

	it('only lists valid statuses as targets', () => {
		for (const [from, targets] of Object.entries(DELIVERY_STATUS_TRANSITIONS)) {
			for (const target of targets) {
				expect(ALL_STATUSES, `${from} → ${target}`).toContain(target);
			}
		}
	});

	it('covers every allowed and rejected transition', () => {
		for (const from of ALL_STATUSES) {
			for (const to of ALL_STATUSES) {
				expect(
					DELIVERY_STATUS_TRANSITIONS[from].includes(to),
					`${from} → ${to}`,
				).toBe(EXPECTED_DELIVERY[from].includes(to));
			}
		}
	});

	it('keeps Failed and Undetermined terminal on Delivery', () => {
		expect(DELIVERY_STATUS_TRANSITIONS.Failed).toEqual([]);
		expect(DELIVERY_STATUS_TRANSITIONS.Undetermined).toEqual([]);
	});

	it('only lets a completed Delivery reopen to Loaded', () => {
		expect(DELIVERY_STATUS_TRANSITIONS.Completed).toEqual(['Loaded']);
	});
});
