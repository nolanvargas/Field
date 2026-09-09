import { apiFetch, expectOk } from './client';
import type { CustomFieldShowWhen } from '../../shared/customFieldShowWhen.js';
import type { EntraWebAuthConfig, WebAuthSource } from '../../shared/webAuthConfig.js';
import type { CustomFieldEntity } from '../../shared/customFieldEntities.js';

import type { TrackingPageTemplate } from '../../shared/trackingPageTemplate.js';

export interface OrgTaskType {
	id?: number;
	name: string;
	slug: string;
	icon: string;
	enabled: boolean;
	sortOrder: number;
	pluralName: string;
	trackingPageTemplate: TrackingPageTemplate;
}

export type OrgCustomFieldDataType =
	| 'text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'lookup'
	| 'select'
	| 'multiselect';

export interface OrgCustomFieldDef {
	slot: number;
	label: string;
	dataType: OrgCustomFieldDataType;
	required: boolean;
	lookupTable: string | null;
	options: string[];
	showWhen?: CustomFieldShowWhen | null;
}

/** Slots are scoped per entity, so defs always travel keyed by entity type. */
export type CustomFieldDefsByEntity = Record<
	CustomFieldEntity,
	OrgCustomFieldDef[]
>;

export interface OrgSettings {
	externalKeyLabel: string;
	cancelRetentionDays: number | null;
	requiredTaskFields: string[];
	webAuthSource: WebAuthSource;
	webAuthConfig: EntraWebAuthConfig;
	taskTypes: OrgTaskType[];
	customFieldDefs: CustomFieldDefsByEntity;
	printTemplatesRevision: string;
	accentColor: string;
}

export interface OrgSettingsUpdatePayload {
	settings?: {
		externalKeyLabel?: string;
		cancelRetentionDays?: number | null;
		requiredTaskFields?: string[];
		webAuthSource?: WebAuthSource;
		webAuthConfig?: EntraWebAuthConfig;
		accentColor?: string;
	};
	taskTypes?: OrgTaskType[];
	customFieldDefs?: Partial<CustomFieldDefsByEntity>;
	actorUserId?: string;
}

export async function getOrgSettings(signal?: AbortSignal): Promise<OrgSettings> {
	const res = await apiFetch('/api/org/settings', { signal });
	return expectOk(res, 'Load org settings failed');
}

export async function updateOrgSettings(
	payload: OrgSettingsUpdatePayload,
	signal?: AbortSignal,
): Promise<OrgSettings> {
	const res = await apiFetch('/api/org/settings', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal,
	});
	return expectOk(res, 'Save org settings failed');
}
