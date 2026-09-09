import { getDocumentType } from '../../shared/documentTypes.js';

export type DevPrintTemplateSummary = {
	id: number;
	orgId: number;
	name: string;
	documentType: string;
	documentTypeLabel: string;
	context: string;
	contentHash: string;
	persist: boolean;
	surfaces: Record<string, boolean>;
	requiresStatus: string | null;
	sortOrder: number;
	updatedAt: string;
};

export type DevPrintTemplateFilters = {
	orgId?: number | string;
	documentType?: string;
	context?: string;
	q?: string;
};

function buildQuery(filters?: DevPrintTemplateFilters): string {
	if (!filters) return '';
	const params = new URLSearchParams();
	if (filters.orgId != null && String(filters.orgId).trim() !== '') {
		params.set('orgId', String(filters.orgId));
	}
	if (filters.documentType?.trim()) {
		params.set('documentType', filters.documentType.trim());
	}
	if (filters.context?.trim()) {
		params.set('context', filters.context.trim());
	}
	if (filters.q?.trim()) {
		params.set('q', filters.q.trim());
	}
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

export async function listDevPrintTemplates(
	filters?: DevPrintTemplateFilters,
): Promise<DevPrintTemplateSummary[]> {
	const res = await fetch(`/api/dev/print-templates${buildQuery(filters)}`);
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(
			typeof data.error === 'string'
				? data.error
				: `Failed to list templates (${res.status})`,
		);
	}
	const data = await res.json();
	return Array.isArray(data.templates) ? data.templates : [];
}

export async function fetchDevPrintTemplate(id: number): Promise<{
	summary: DevPrintTemplateSummary;
	template: unknown;
}> {
	const res = await fetch(`/api/dev/print-templates/${id}`);
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(
			typeof data.error === 'string'
				? data.error
				: `Failed to load template (${res.status})`,
		);
	}
	return res.json();
}

export function buildBlankPrintTemplate(
	documentTypeKey: string,
	displayName?: string,
): Record<string, unknown> {
	const docType = getDocumentType(documentTypeKey);
	const label =
		displayName?.trim() || docType?.label?.trim() || documentTypeKey;
	const context = docType?.context ?? 'task';
	return {
		label,
		context,
		surfaces: context === 'task' ? { taskMenu: false } : {},
		requiresStatus: null,
		persist: false,
		page: 'letter',
		margin: 50,
		blocks: [
			{ type: 'header', title: label, logo: true },
			{
				type: 'text',
				value: 'Replace this starter layout with your blocks and {{tags}}.',
			},
		],
	};
}

export type CreateDevPrintTemplateResult = {
	id: number;
	documentType: string;
};

export async function createDevPrintTemplate(input: {
	orgId: number;
	documentType: string;
	name?: string;
	template?: unknown;
}): Promise<CreateDevPrintTemplateResult> {
	const template =
		input.template ??
		buildBlankPrintTemplate(input.documentType, input.name);
	const res = await fetch('/api/dev/print-templates', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			orgId: input.orgId,
			documentType: input.documentType,
			name: input.name,
			template,
		}),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(
			typeof data.error === 'string'
				? data.error
				: `Failed to create template (${res.status})`,
		);
	}
	const data = await res.json();
	const id = Number(data.id);
	if (!Number.isInteger(id) || id < 1) {
		throw new Error('Create response missing template id');
	}
	return {
		id,
		documentType: String(data.documentType ?? input.documentType),
	};
}

export async function saveDevPrintTemplate(
	id: number,
	template: unknown,
	name?: string,
): Promise<void> {
	const res = await fetch(`/api/dev/print-templates/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ template, name }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(
			typeof data.error === 'string'
				? data.error
				: `Failed to save template (${res.status})`,
		);
	}
}

export async function listDevPrintTemplateTags(): Promise<string[]> {
	const res = await fetch('/api/dev/print-templates/tags');
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data.tags) ? data.tags : [];
}

export async function previewDevPrintTemplate(
	id: number,
	task: Record<string, unknown>,
	template?: unknown,
): Promise<Blob> {
	const res = await fetch(`/api/dev/print-templates/${id}/preview`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ task, template }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(
			typeof data.error === 'string'
				? data.error
				: `Preview failed (${res.status})`,
		);
	}
	const data = await res.json();
	if (typeof data.pdfBase64 !== 'string') {
		throw new Error('Preview response missing PDF data');
	}
	const binary = atob(data.pdfBase64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: 'application/pdf' });
}

export const SAMPLE_PREVIEW_TASK: Record<string, unknown> = {
	id: 42,
	externalKey: '99290',
	status: 'Completed',
	taskType: 'Delivery',
	description: '<p>Bring ladder. Ring bell twice.</p>',
	jobTitle: 'Furniture delivery',
	destinationAddressName: 'City Hall',
	destinationAddress: '1 Main St',
	destinationBuilding: 'Suite 200',
	destinationNotes: 'Use loading dock B',
	completedNotes: 'Left with reception',
	completedAt: '2026-07-15T13:09:00.000Z',
	createdAt: '2026-07-14T10:00:00.000Z',
	createdByName: 'Alex',
	completionNotesByName: 'Genevieve',
	contacts: [
		{
			name: 'Sam',
			email: 'sam@example.com',
			phone: '555-0100',
			isPoc: true,
		},
	],
	crewMembers: [{ displayName: 'Jordan' }, { displayName: 'Casey' }],
	customFieldDefs: [{ slot: 1, label: 'PO Number' }],
	customFieldDisplays: { 1: 'PO-123' },
};
