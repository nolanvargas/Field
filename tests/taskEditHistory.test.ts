import { describe, expect, it } from 'vitest';
import { summarizeTaskEditChanges } from '../shared/taskEditHistory.js';

describe('summarizeTaskEditChanges', () => {
	it('describes window start changes', () => {
		const lines = summarizeTaskEditChanges(
			{
				status: 'Assigned',
				taskType: 'Delivery',
				description: null,
				jobTitle: null,
				externalKey: null,
				destinationAddressId: null,
				destinationAddressName: null,
				destinationAddress: null,
				destinationBuilding: null,
				destinationNotes: null,
				windowStartAt: '2026-07-29T17:00:00.000Z',
				windowEndAt: null,
				contactIds: [],
				crewMemberIds: ['a'],
				customFields: {},
			},
			{
				status: 'Assigned',
				taskType: 'Delivery',
				description: null,
				jobTitle: null,
				externalKey: null,
				destinationAddressId: null,
				destinationAddressName: null,
				destinationAddress: null,
				destinationBuilding: null,
				destinationNotes: null,
				windowStartAt: '2026-07-29T16:00:00.000Z',
				windowEndAt: null,
				contactIds: [],
				crewMemberIds: ['a'],
				customFields: {},
			},
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/^Start: .+ → .+$/);
	});

	it('returns nothing when unchanged', () => {
		const snapshot = {
			status: 'Unassigned',
			taskType: 'Delivery',
			description: 'Same',
			jobTitle: null,
			externalKey: null,
			destinationAddressId: null,
			destinationAddressName: null,
			destinationAddress: null,
			destinationBuilding: null,
			destinationNotes: null,
			windowStartAt: null,
			windowEndAt: null,
			contactIds: [],
			crewMemberIds: [],
			customFields: {},
		};
		expect(summarizeTaskEditChanges(snapshot, { ...snapshot })).toEqual([]);
	});
});
