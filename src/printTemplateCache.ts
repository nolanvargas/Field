import {
	fetchOrgPrintTemplates,
	type PrintTemplateMenuItem,
} from './api/printTemplates';

const CACHE_KEY = 'field:printTemplates';
const REVISION_KEY = 'field:printTemplates:revision';

type PrintTemplateCachePayload = {
	revision: string;
	templates: PrintTemplateMenuItem[];
};

function readCache(): PrintTemplateCachePayload | null {
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PrintTemplateCachePayload;
		if (
			!parsed ||
			typeof parsed.revision !== 'string' ||
			!Array.isArray(parsed.templates)
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function getCachedPrintTemplatesRevision(): string | null {
	return localStorage.getItem(REVISION_KEY);
}

export function getCachedPrintMenuItems(): PrintTemplateMenuItem[] {
	return readCache()?.templates ?? [];
}

function writeCache(revision: string, templates: PrintTemplateMenuItem[]) {
	localStorage.setItem(REVISION_KEY, revision);
	localStorage.setItem(
		CACHE_KEY,
		JSON.stringify({ revision, templates }),
	);
}

/**
 * Sync local print template menu metadata when org revision changes.
 */
export async function syncPrintTemplateCache(
	orgRevision: string,
	signal?: AbortSignal,
): Promise<PrintTemplateMenuItem[]> {
	const cached = readCache();
	if (cached?.revision === orgRevision) {
		return cached.templates;
	}

	const data = await fetchOrgPrintTemplates(signal);
	const menuItems = data.templates
		.filter((entry) => entry.surfaces?.taskMenu === true)
		.map((entry) => ({
			documentType: entry.documentType,
			label: entry.label,
			menuGroup: entry.menuGroup,
			sortOrder: entry.sortOrder,
		}))
		.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

	writeCache(data.revision, menuItems);
	return menuItems;
}

export function groupPrintMenuItems(
	items: PrintTemplateMenuItem[],
): { group: string | null; items: PrintTemplateMenuItem[] }[] {
	const grouped = new Map<string | null, PrintTemplateMenuItem[]>();
	for (const item of items) {
		const key = item.menuGroup?.trim() ? item.menuGroup.trim() : null;
		const bucket = grouped.get(key) ?? [];
		bucket.push(item);
		grouped.set(key, bucket);
	}

	return [...grouped.entries()]
		.sort(([a], [b]) => {
			if (a == null) return 1;
			if (b == null) return -1;
			return a.localeCompare(b);
		})
		.map(([group, groupItems]) => ({
			group,
			items: groupItems.sort(
				(a, b) =>
					a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
			),
		}));
}
