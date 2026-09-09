export interface OrgSettingsSnapshotInput {
	externalKeyLabel?: string;
	accentColor?: string;
	cancelRetentionDays?: number | null;
	requiredTaskFields?: string[];
	webAuthSource?: string;
	webAuthConfig?: {
		clientId?: string;
		tenantId?: string;
	};
	taskTypes?: Array<{
		id?: number;
		name?: string;
		slug?: string;
		icon?: string;
		enabled?: boolean;
		sortOrder?: number;
		pluralName?: string;
		trackingPageTemplate?: Record<string, unknown>;
	}>;
	customFieldDefs?: Partial<
		Record<
			import('./customFieldEntities.js').CustomFieldEntity,
			Array<{
				slot?: number;
				label?: string;
				dataType?: string;
				required?: boolean;
				lookupTable?: string | null;
				options?: string[];
				showWhen?: { taskTypeNames?: string[] } | null;
			}>
		>
	>;
}

export function snapshotOrgSettings(settings: OrgSettingsSnapshotInput): string;
export function isOrgSettingsDraftDirty(
	draft: OrgSettingsSnapshotInput,
	baseline: OrgSettingsSnapshotInput,
): boolean;
