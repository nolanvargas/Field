/**
 * Canonical org catalog defaults (migration 039 + 052 plural names).
 * Used by scripts/reset-org-config.mjs — not a tenant-facing reset path.
 */

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
	accentColor: '#732e75',
});
