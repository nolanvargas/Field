import { describe, expect, it } from 'vitest';
import {
	isOrgSettingsDraftDirty,
	snapshotOrgSettings,
} from '../shared/orgSettingsDraft.js';

const baseline = {
	externalKeyLabel: 'External key',
	accentColor: '#732e75',
	cancelRetentionDays: 7,
	requiredTaskFields: ['taskDesc', 'crew'],
	taskTypes: [
		{
			id: 1,
			name: 'Delivery',
			slug: 'delivery',
			icon: 'Truck',
			enabled: true,
			sortOrder: 0,
			pluralName: 'Deliveries',
			trackingPageTemplate: {
				version: 2,
				blocks: [],
			},
		},
	],
	customFieldDefs: {
		task: [
			{
				slot: 1,
				label: 'Color',
				dataType: 'select',
				required: false,
				lookupTable: null,
				options: ['Red', 'Blue'],
				showWhen: null,
			},
		],
		user: [
			{
				slot: 1,
				label: 'Employee ID',
				dataType: 'text',
				required: false,
				lookupTable: null,
				options: [],
			},
		],
		contact: [],
		address: [],
	},
};

describe('isOrgSettingsDraftDirty', () => {
	it('returns false for identical settings', () => {
		expect(isOrgSettingsDraftDirty(baseline, baseline)).toBe(false);
		expect(
			isOrgSettingsDraftDirty(
				{ ...baseline, externalKeyLabel: ' External key ' },
				baseline,
			),
		).toBe(false);
	});

	it('detects scalar and list edits', () => {
		expect(
			isOrgSettingsDraftDirty(
				{ ...baseline, externalKeyLabel: 'Job number' },
				baseline,
			),
		).toBe(true);
		expect(
			isOrgSettingsDraftDirty(
				{ ...baseline, accentColor: '#1c7ed6' },
				baseline,
			),
		).toBe(true);
		expect(
			isOrgSettingsDraftDirty(
				{ ...baseline, requiredTaskFields: ['crew', 'taskDesc'] },
				baseline,
			),
		).toBe(false);
		expect(
			isOrgSettingsDraftDirty(
				{ ...baseline, requiredTaskFields: ['crew'] },
				baseline,
			),
		).toBe(true);
	});

	it('detects nested task type and custom field edits', () => {
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					taskTypes: [{ ...baseline.taskTypes[0], name: 'Pickup' }],
				},
				baseline,
			),
		).toBe(true);
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					customFieldDefs: {
						...baseline.customFieldDefs,
						task: [
							{
								...baseline.customFieldDefs.task[0],
								options: ['Red', 'Green'],
							},
						],
					},
				},
				baseline,
			),
		).toBe(true);
	});

	it('detects edits scoped to one entity type', () => {
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					customFieldDefs: {
						...baseline.customFieldDefs,
						user: [
							{ ...baseline.customFieldDefs.user[0], label: 'Staff number' },
						],
					},
				},
				baseline,
			),
		).toBe(true);
	});

	it('does not confuse identical slots across entity types', () => {
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					customFieldDefs: {
						...baseline.customFieldDefs,
						contact: [{ ...baseline.customFieldDefs.task[0] }],
					},
				},
				baseline,
			),
		).toBe(true);
	});

	it('treats added empty custom field rows as dirty', () => {
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					customFieldDefs: {
						...baseline.customFieldDefs,
						task: [
							...baseline.customFieldDefs.task,
							{
								slot: 2,
								label: '',
								dataType: 'text',
								required: false,
								lookupTable: null,
								options: [],
							},
						],
					},
				},
				baseline,
			),
		).toBe(true);
	});

	it('detects tracking page template edits', () => {
		expect(
			isOrgSettingsDraftDirty(
				{
					...baseline,
					taskTypes: [
						{
							...baseline.taskTypes[0],
							trackingPageTemplate: {
								...baseline.taskTypes[0].trackingPageTemplate,
								blocks: [
									{
										id: 'headline',
										type: 'text',
										html: '<h1>{{task.headline}}</h1>',
									},
								],
							},
						},
					],
				},
				baseline,
			),
		).toBe(true);
	});
});

describe('snapshotOrgSettings', () => {
	it('produces stable output for equivalent input', () => {
		const a = snapshotOrgSettings(baseline);
		const b = snapshotOrgSettings({
			...baseline,
			externalKeyLabel: ' External key ',
			requiredTaskFields: ['crew', 'taskDesc'],
		});
		expect(a).toBe(b);
	});
});
