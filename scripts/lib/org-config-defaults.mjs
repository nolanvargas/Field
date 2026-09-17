/**
 * Sandbocks dev org catalog — applied by npm run db:reset-org-config only.
 * Production ships an empty catalog (migration 071); tenants configure in Management.
 */

import { FIELD_BRAND_ACCENT } from '../../shared/fieldBrand.js';

/** @type {readonly { name: string, slug: string, icon: string, sortOrder: number, pluralName: string }[]} */
export const DEFAULT_TASK_TYPES = Object.freeze([
	{
		name: 'Delivery',
		slug: 'Delivery',
		icon: 'Truck',
		sortOrder: 0,
		pluralName: 'Deliveries',
	},
	{
		name: 'Install',
		slug: 'Install',
		icon: 'Wrench',
		sortOrder: 1,
		pluralName: 'Installs',
	},
	{
		name: 'Removal',
		slug: 'Removal',
		icon: 'PackageMinus',
		sortOrder: 2,
		pluralName: 'Removals',
	},
	{
		name: 'Site Survey',
		slug: 'Site Survey',
		icon: 'ClipboardCheck',
		sortOrder: 3,
		pluralName: 'Site Surveys',
	},
	{
		name: 'Pickup',
		slug: 'Pickup',
		icon: 'Package',
		sortOrder: 4,
		pluralName: 'Pickups',
	},
	{
		name: 'Other',
		slug: 'Other',
		icon: 'CircleHelp',
		sortOrder: 5,
		pluralName: 'Tasks',
	},
]);

/** @type {{ externalKeyLabel: string, cancelRetentionDays: number, requiredTaskFields: string[], accentColor: string }} */
export const DEFAULT_ORG_SETTINGS = Object.freeze({
	externalKeyLabel: 'Job',
	cancelRetentionDays: 7,
	requiredTaskFields: [],
	accentColor: FIELD_BRAND_ACCENT,
});

/**
 * Sandbocks dev task custom fields — slots used in scripts/seed-dev-tasks.mjs.
 * Seeded into org_custom_field_defs by scripts/lib/seedDevOrgConfig.mjs.
 * @type {readonly { slot: number, label: string, dataType: string, required: boolean, lookupTable: string | null, options: readonly string[] }[]}
 */
/**
 * Sandbocks dev task attachment types — seeded by seedDevOrgConfig.mjs.
 * @type {readonly { slug: string, label: string, allowedMimeCategories: readonly string[], showWhen?: { taskTypeNames: string[] } | null, sortOrder: number }[]}
 */
export const DEV_ATTACHMENT_TYPE_DEFS = Object.freeze([
	{
		slug: 'completion_photos',
		label: 'Completion photos',
		allowedMimeCategories: ['image', 'video', 'pdf', 'other'],
		showWhen: null,
		sortOrder: 0,
	},
	{
		slug: 'meter',
		label: 'Meter',
		allowedMimeCategories: ['image'],
		showWhen: { taskTypeNames: ['Site Survey', 'Install'] },
		sortOrder: 1,
	},
]);

export const DEV_CUSTOM_FIELD_DEFS = Object.freeze([
	{
		slot: 1,
		label: 'Crew size',
		dataType: 'number',
		required: false,
		lookupTable: null,
		options: [],
	},
	{
		slot: 2,
		label: 'Estimated hours',
		dataType: 'number',
		required: false,
		lookupTable: null,
		options: [],
	},
	{
		slot: 3,
		label: 'Can start early',
		dataType: 'boolean',
		required: false,
		lookupTable: null,
		options: [],
	},
	{
		slot: 4,
		label: 'Time specific',
		dataType: 'boolean',
		required: false,
		lookupTable: null,
		options: [],
	},
]);
