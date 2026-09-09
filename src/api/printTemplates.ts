import { apiFetch, readJson } from './client';

export type PrintTemplateMenuItem = {
	documentType: string;
	label: string;
	menuGroup: string | null;
	sortOrder: number;
};

export type OrgPrintTemplateEntry = PrintTemplateMenuItem & {
	context: string;
	surfaces: Record<string, boolean>;
	persist: boolean;
	requiresStatus: string | null;
	hash: string;
	name: string;
	template?: unknown;
};

export type OrgPrintTemplatesResponse = {
	revision: string;
	templates: OrgPrintTemplateEntry[];
};

export async function fetchOrgPrintTemplates(
	signal?: AbortSignal,
): Promise<OrgPrintTemplatesResponse> {
	const res = await apiFetch('/api/org/print-templates', { signal });
	if (!res.ok) {
		const data = await readJson<{ error?: string }>(res);
		throw new Error(data.error ?? `Load print templates failed (${res.status})`);
	}
	return readJson<OrgPrintTemplatesResponse>(res);
}

export async function listPrintTemplates(
	context?: string,
	surface?: string,
): Promise<PrintTemplateMenuItem[]> {
	const params = new URLSearchParams();
	if (context) params.set('context', context);
	if (surface) params.set('surface', surface);
	const qs = params.toString();
	const res = await apiFetch(
		`/api/print-templates${qs ? `?${qs}` : ''}`,
	);
	if (!res.ok) return [];
	const data = await readJson<{ templates?: PrintTemplateMenuItem[] }>(res);
	return Array.isArray(data.templates) ? data.templates : [];
}

/** Render a print template PDF and open it in a new tab for viewing/printing. */
export async function openPrintTemplate(
	documentType: string,
	contextPayload: { context: 'task'; taskId: number },
): Promise<void> {
	const printWindow = window.open('about:blank', '_blank');
	try {
		const res = await apiFetch(
			`/api/print/${encodeURIComponent(documentType)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(contextPayload),
			},
		);
		if (!res.ok) {
			const data = await readJson<{ error?: string }>(res);
			throw new Error(data.error ?? `Print failed (${res.status})`);
		}
		const buf = await res.arrayBuffer();
		const blob = new Blob([buf], { type: 'application/pdf' });
		const url = URL.createObjectURL(blob);
		if (printWindow) {
			printWindow.location.replace(url);
		} else {
			window.open(url, '_blank');
		}
		window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
	} catch (err) {
		printWindow?.close();
		throw err;
	}
}
