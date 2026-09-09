/**
 * Compare org settings drafts for unsaved-change detection (Management page).
 */

import { normalizeEntraWebAuthConfig } from "./webAuthConfig.js";
import {
	ALL_CUSTOM_FIELD_ENTITIES,
	customFieldDefsByEntityFrom,
} from "./customFieldEntities.js";
import { normalizeShowWhen } from "./customFieldShowWhen.js";
import { snapshotTrackingPageTemplate } from "./trackingPageTemplate.js";

function normalizeTaskType(type) {
	return {
		id: type.id ?? null,
		name: String(type.name ?? '').trim(),
		slug: String(type.slug ?? '').trim(),
		icon: String(type.icon ?? '').trim(),
		enabled: Boolean(type.enabled),
		sortOrder: Number(type.sortOrder) || 0,
		pluralName: String(type.pluralName ?? '').trim(),
		trackingPageTemplate: snapshotTrackingPageTemplate(
			type.trackingPageTemplate,
			String(type.name ?? '').trim() || 'Delivery',
		),
	};
}

function normalizeCustomFieldDef(def) {
	return {
		slot: Number(def.slot) || 0,
		label: String(def.label ?? '').trim(),
		dataType: String(def.dataType ?? 'text'),
		required: Boolean(def.required),
		lookupTable: def.lookupTable ?? null,
		options: (def.options ?? []).map((o) => String(o ?? '').trim()).filter(Boolean),
		showWhen: normalizeShowWhen(def.showWhen),
	};
}

/**
 * Stable JSON snapshot for equality checks.
 * @param {import('./orgSettingsDraft.d.ts').OrgSettingsSnapshotInput} settings
 */
export function snapshotOrgSettings(settings) {
	return JSON.stringify({
		externalKeyLabel: String(settings.externalKeyLabel ?? '').trim(),
		accentColor: String(settings.accentColor ?? '').trim().toLowerCase(),
		cancelRetentionDays: settings.cancelRetentionDays ?? null,
		requiredTaskFields: [...(settings.requiredTaskFields ?? [])].sort(),
		webAuthSource: String(settings.webAuthSource ?? 'env'),
		webAuthConfig: normalizeEntraWebAuthConfig(settings.webAuthConfig),
		taskTypes: (settings.taskTypes ?? [])
			.map(normalizeTaskType)
			.sort((a, b) => a.sortOrder - b.sortOrder),
		customFieldDefs: normalizeCustomFieldDefsByEntity(settings.customFieldDefs),
	});
}

/**
 * @param {unknown} raw
 */
function normalizeCustomFieldDefsByEntity(raw) {
	const byEntity = customFieldDefsByEntityFrom(raw);
	/** @type {Record<string, unknown[]>} */
	const out = {};
	for (const entity of ALL_CUSTOM_FIELD_ENTITIES) {
		out[entity] = byEntity[entity]
			.map(normalizeCustomFieldDef)
			.sort((a, b) => a.slot - b.slot);
	}
	return out;
}

/**
 * @param {import('./orgSettingsDraft.d.ts').OrgSettingsSnapshotInput} draft
 * @param {import('./orgSettingsDraft.d.ts').OrgSettingsSnapshotInput} baseline
 */
export function isOrgSettingsDraftDirty(draft, baseline) {
	return snapshotOrgSettings(draft) !== snapshotOrgSettings(baseline);
}
