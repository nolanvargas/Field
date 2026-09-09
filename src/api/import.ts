import { apiFetch, expectOk } from './client';

export type ImportEntity = 'contacts' | 'addresses' | 'users';

export type ImportMode = 'blank' | 'sample' | 'current';

export type ImportRowStatus = 'new' | 'update' | 'conflict' | 'error';

export interface ImportPreviewRow {
	rowIndex: number;
	status: ImportRowStatus;
	errors?: string[];
	imported: Record<string, string>;
	existing?: Record<string, string>;
	matchId?: string;
}

export interface ImportPreviewResult {
	rows: ImportPreviewRow[];
	summary: {
		new: number;
		update: number;
		conflict: number;
		error: number;
	};
}

export interface ImportApplyRow {
	rowIndex: number;
	status: ImportRowStatus;
	imported: Record<string, string>;
	existing?: Record<string, string>;
	matchId?: string;
	resolution?: Record<string, 'imported' | 'existing'>;
}

export interface ImportApplyResult {
	created: number;
	updated: number;
	errors: string[];
}

function triggerDownload(blob: Blob, fileName: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	a.click();
	URL.revokeObjectURL(url);
}

export async function downloadImportCsv(
	entity: ImportEntity,
	mode: ImportMode,
	actorUserId?: string,
): Promise<void> {
	const params = new URLSearchParams({ mode });
	if (actorUserId) params.set('actorUserId', actorUserId);
	const res = await apiFetch(`/api/import/${entity}/template?${params}`);
	if (!res.ok) {
		const data = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(data.error ?? `Download failed (${res.status})`);
	}
	const blob = await res.blob();
	const disposition = res.headers.get('Content-Disposition') ?? '';
	const match = disposition.match(/filename="([^"]+)"/);
	const fileName = match?.[1] ?? `${entity}-import.csv`;
	triggerDownload(blob, fileName);
}

export async function previewImport(
	entity: ImportEntity,
	file: File,
	actorUserId?: string,
): Promise<ImportPreviewResult> {
	const params = new URLSearchParams();
	if (actorUserId) params.set('actorUserId', actorUserId);
	const qs = params.toString();
	const form = new FormData();
	form.append('file', file);
	const res = await apiFetch(
		`/api/import/${entity}/preview${qs ? `?${qs}` : ''}`,
		{
			method: 'POST',
			body: form,
		},
	);
	return expectOk(res, 'Import preview failed');
}

export async function applyImport(
	entity: ImportEntity,
	rows: ImportApplyRow[],
	actorUserId?: string,
): Promise<ImportApplyResult> {
	const res = await apiFetch(`/api/import/${entity}/apply`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ rows, actorUserId }),
	});
	return expectOk(res, 'Import apply failed');
}
