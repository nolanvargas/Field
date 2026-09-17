import { apiFetch } from './client';

export type ExportCuratedTaskResult = {
	slug: string;
	seedId: number;
	path: string;
	capturedAt: string;
};

export async function exportTaskToCuratedFixtures(
	taskId: number,
	slug?: string,
): Promise<ExportCuratedTaskResult> {
	const res = await apiFetch('/api/dev/curated-tasks', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ taskId, slug: slug?.trim() || undefined }),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(body.error ?? `Export failed (${res.status})`);
	}
	return res.json() as Promise<ExportCuratedTaskResult>;
}
