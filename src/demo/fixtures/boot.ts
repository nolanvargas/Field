import type { AppUser } from '../../api/users';
import type { OrgSettings } from '../../api/orgSettings';
import type { OrgPrintTemplatesResponse } from '../../api/printTemplates';
import { ALL_PERMISSIONS } from '../../../shared/permissions.js';
import { defaultTrackingPageTemplate } from '../../../shared/trackingPageTemplate.js';
import {
	DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
	DEMO_ATTACHMENT_TYPE_METER_ID,
} from './attachmentMedia';

/** Demo tenant branding (Showcase INC). */
export const DEMO_ORG_DISPLAY_NAME = 'Showcase INC';
export const DEMO_ORG_ACCENT = '#15616d';
export const DEMO_ORG_LOGO_URL = '/demo/showcase-logo.png';

/** Stable id for the demo dispatch admin (boot user). */
export const DEMO_ADMIN_USER_ID = 'a1111111-1111-4111-8111-111111111111';

export const DEMO_CREW_USER_ID = 'b2222222-2222-4222-8222-222222222222';

const DEFAULT_TASK_TYPE_NAMES = [
	'Delivery',
	'Install',
	'Removal',
	'Site Survey',
	'Pickup',
	'Other',
] as const;

const TASK_TYPE_META: Record<
	string,
	{ icon: string; sortOrder: number; pluralName: string }
> = {
	Delivery: { icon: 'Truck', sortOrder: 0, pluralName: 'Deliveries' },
	Install: { icon: 'Wrench', sortOrder: 1, pluralName: 'Installs' },
	Removal: { icon: 'PackageMinus', sortOrder: 2, pluralName: 'Removals' },
	'Site Survey': {
		icon: 'ClipboardCheck',
		sortOrder: 3,
		pluralName: 'Site Surveys',
	},
	Pickup: { icon: 'Package', sortOrder: 4, pluralName: 'Pickups' },
	Other: { icon: 'CircleHelp', sortOrder: 5, pluralName: 'Tasks' },
};

export function buildBootUsers(): AppUser[] {
	return [
		{
			id: DEMO_ADMIN_USER_ID,
			displayName: 'Demo Dispatch',
			email: 'dispatch@demo.fieldwm.com',
			phone: '',
			role: 'Operations',
			permissions: [...ALL_PERMISSIONS],
			customFields: {},
			customFieldDisplays: {},
		},
		{
			id: DEMO_CREW_USER_ID,
			displayName: 'Demo Crew',
			email: 'crew@demo.fieldwm.com',
			phone: '',
			role: 'Crew',
			permissions: [],
			customFields: {},
			customFieldDisplays: {},
		},
	];
}

export function buildBootOrgSettings(): OrgSettings {
	return {
		externalKeyLabel: 'Job',
		cancelRetentionDays: 7,
		requiredTaskFields: [],
		webAuthSource: 'env',
		webAuthConfig: { clientId: '', tenantId: '' },
		taskTypes: DEFAULT_TASK_TYPE_NAMES.map((name) => {
			const meta = TASK_TYPE_META[name];
			return {
				name,
				slug: name,
				icon: meta.icon,
				enabled: true,
				sortOrder: meta.sortOrder,
				pluralName: meta.pluralName,
				trackingPageTemplate: defaultTrackingPageTemplate(name),
			};
		}),
		customFieldDefs: {
			task: [],
			user: [],
			contact: [],
			address: [],
		},
		attachmentTypeDefs: [
			{
				id: DEMO_ATTACHMENT_TYPE_COMPLETION_PHOTOS_ID,
				slug: 'completion_photos',
				label: 'Completion photos',
				allowedMimeCategories: ['image', 'video', 'pdf', 'other'],
				showWhen: null,
				sortOrder: 0,
			},
			{
				id: DEMO_ATTACHMENT_TYPE_METER_ID,
				slug: 'meter',
				label: 'Meter',
				allowedMimeCategories: ['image'],
				showWhen: { taskTypeNames: ['Site Survey', 'Install'] },
				sortOrder: 1,
			},
		],
		printTemplatesRevision: 'demo-boot-1',
		accentColor: DEMO_ORG_ACCENT,
		logoUrl: DEMO_ORG_LOGO_URL,
		logoHighContrast: true,
	};
}

export function buildBootPrintTemplates(): OrgPrintTemplatesResponse {
	return {
		revision: 'demo-boot-1',
		templates: [],
	};
}
