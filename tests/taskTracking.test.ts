/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getTrackingDocument,
	getTrackingImageAttachment,
	getTrackingPageByToken,
} from '../server/taskTracking.mjs';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
	getOrgSettings: vi.fn(),
	getTrackingPageHistory: vi.fn(),
	companyName: vi.fn(),
	renderPrint: vi.fn(),
	getObjectBuffer: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/orgSettings.mjs', () => ({
	getOrgSettings: mocks.getOrgSettings,
}));
vi.mock('../server/taskHistory.mjs', () => ({
	getTrackingPageHistory: mocks.getTrackingPageHistory,
}));
vi.mock('../server/branding.mjs', () => ({
	companyName: mocks.companyName,
}));
vi.mock('../server/print.mjs', () => ({
	CURRENT_PRINT_STORAGE_PREFIX: 'prints/',
	printFileName: (kind: string, taskId: number) => `${kind}-${taskId}.pdf`,
	printStorageKind: (kind: string) => kind,
	renderPrint: mocks.renderPrint,
}));
vi.mock('../server/storage.mjs', () => ({
	getObjectBuffer: mocks.getObjectBuffer,
}));

const TOKEN = 'valid-tracking-token';
const originalPublicUrl = process.env.PUBLIC_APP_URL;

interface TaskRow {
	id: number;
	status: string;
	task_type: string;
	job_title: string;
	external_key: string;
	completed_at: string | null;
	tracking_token: string;
	destination_name: string;
	contact_name: string;
	tracking_page_template: unknown;
}

function baseTaskRow(overrides: Partial<TaskRow> = {}): TaskRow {
	return {
		id: 42,
		status: 'Assigned',
		task_type: 'Delivery',
		job_title: 'ACME delivery',
		external_key: 'JOB-1',
		completed_at: null,
		tracking_token: TOKEN,
		destination_name: 'ACME HQ',
		contact_name: 'Jane',
		tracking_page_template: null,
		...overrides,
	};
}

function makeTrackingPool(
	taskRow: TaskRow | null,
	docRows: Array<{ kind: string; file_name: string }> = [],
	imageRows: Array<{
		id: number;
		file_name: string;
		caption: string | null;
		mime_type: string;
		storage_key?: string;
	}> = [],
) {
	return {
		query: vi.fn(async (sql: string, params?: unknown[]) => {
			if (sql.includes('FROM tasks t') && sql.includes('tracking_token')) {
				return { rows: taskRow ? [taskRow] : [], rowCount: taskRow ? 1 : 0 };
			}
			if (
				sql.includes('FROM tasks') &&
				sql.includes('tracking_token = $1') &&
				!sql.includes('ott.tracking_page_template')
			) {
				return {
					rows: taskRow
						? [
								{
									id: taskRow.id,
									task_type: taskRow.task_type,
									status: taskRow.status,
								},
							]
						: [],
					rowCount: taskRow ? 1 : 0,
				};
			}
			if (sql.includes('ott.tracking_page_template') && sql.includes('WHERE t.id')) {
				return {
					rows: taskRow
						? [
								{
									task_type: taskRow.task_type,
									tracking_page_template: taskRow.tracking_page_template,
								},
							]
						: [],
					rowCount: taskRow ? 1 : 0,
				};
			}
			if (sql.includes('FROM task_documents')) {
				if (sql.includes('kind = ANY')) {
					return { rows: docRows, rowCount: docRows.length };
				}
				if (params?.[1] === 'proof_of_completion') {
					const row = docRows.find((d) => d.kind === 'proof_of_completion');
					return { rows: row ? [{ storage_key: row.file_name, file_name: row.file_name }] : [], rowCount: row ? 1 : 0 };
				}
				if (params?.[1] === 'delivery_docket') {
					return { rows: [], rowCount: 0 };
				}
			}
			if (sql.includes('FROM task_attachments')) {
				if (sql.includes('storage_key')) {
					return {
						rows: imageRows.map((row) => ({
							storage_key: row.storage_key ?? 'attachments/42/photo.jpg',
							mime_type: row.mime_type,
							file_name: row.file_name,
						})),
						rowCount: imageRows.length,
					};
				}
				return { rows: imageRows, rowCount: imageRows.length };
			}
			throw new Error(`Unexpected query: ${sql.slice(0, 120)}`);
		}),
	};
}

describe('getTrackingPageByToken', () => {
	beforeEach(() => {
		mocks.getOrgSettings.mockResolvedValue({
			accentColor: '#732e75',
			logoUrl: '/api/org/logo?v=1',
		});
		mocks.getTrackingPageHistory.mockResolvedValue([]);
		mocks.companyName.mockReturnValue('Field');
	});

	afterEach(() => {
		if (originalPublicUrl === undefined) {
			delete process.env.PUBLIC_APP_URL;
		} else {
			process.env.PUBLIC_APP_URL = originalPublicUrl;
		}
	});

	it('returns 404 for empty, whitespace, or overlong tokens', async () => {
		mocks.getPool.mockReturnValue(makeTrackingPool(baseTaskRow()));
		for (const token of ['', '   ', 'x'.repeat(65)]) {
			await expect(getTrackingPageByToken(token)).rejects.toMatchObject({
				message: 'Not found',
				status: 404,
			});
		}
	});

	it('returns 404 when no task matches the token', async () => {
		mocks.getPool.mockReturnValue(makeTrackingPool(null));
		await expect(getTrackingPageByToken(TOKEN)).rejects.toMatchObject({
			status: 404,
		});
	});

	it('includes logoUrl from org settings', async () => {
		mocks.getPool.mockReturnValue(makeTrackingPool(baseTaskRow()));
		const page = await getTrackingPageByToken(TOKEN);
		expect(page.logoUrl).toBe('/api/org/logo?v=1');
	});

	it('marks proof_of_completion available only when Completed or stored', async () => {
		mocks.getPool.mockReturnValue(
			makeTrackingPool(
				baseTaskRow({ status: 'In Progress' }),
				[{ kind: 'proof_of_completion', file_name: 'pod.pdf' }],
			),
		);
		const inProgress = await getTrackingPageByToken(TOKEN);
		const pod = inProgress.documents.find((d) => d.kind === 'proof_of_completion');
		expect(pod?.available).toBe(true);

		mocks.getPool.mockReturnValue(
			makeTrackingPool(baseTaskRow({ status: 'In Progress' }), []),
		);
		const noDoc = await getTrackingPageByToken(TOKEN);
		const podMissing = noDoc.documents.find(
			(d) => d.kind === 'proof_of_completion',
		);
		expect(podMissing?.available).toBe(false);

		mocks.getPool.mockReturnValue(
			makeTrackingPool(baseTaskRow({ status: 'Completed' }), []),
		);
		const completed = await getTrackingPageByToken(TOKEN);
		const podCompleted = completed.documents.find(
			(d) => d.kind === 'proof_of_completion',
		);
		expect(podCompleted?.available).toBe(true);
	});

	it('includes delivery docket only for Delivery tasks', async () => {
		mocks.getPool.mockReturnValue(
			makeTrackingPool(baseTaskRow({ task_type: 'Delivery' })),
		);
		const delivery = await getTrackingPageByToken(TOKEN);
		expect(
			delivery.documents.some((d) => d.kind === 'delivery_docket'),
		).toBe(true);

		mocks.getPool.mockReturnValue(
			makeTrackingPool(baseTaskRow({ task_type: 'Install' })),
		);
		const install = await getTrackingPageByToken(TOKEN);
		expect(
			install.documents.some((d) => d.kind === 'delivery_docket'),
		).toBe(false);
	});

	it('returns trackingPath and trackingUrl using PUBLIC_APP_URL', async () => {
		process.env.PUBLIC_APP_URL = 'https://track.example.com';
		mocks.getPool.mockReturnValue(makeTrackingPool(baseTaskRow()));
		const page = await getTrackingPageByToken(TOKEN);
		expect(page.trackingPath).toBe(`/t/${TOKEN}`);
		expect(page.trackingUrl).toBe(`https://track.example.com/t/${TOKEN}`);
	});

	it('includes completion images when the template has the block', async () => {
		mocks.getPool.mockReturnValue(
			makeTrackingPool(
				baseTaskRow({
					tracking_page_template: {
						version: 2,
						blocks: [
							{
								id: 'images',
								type: 'imageAttachments',
								tatKeys: ['completion_photos'],
							},
						],
					},
				}),
				[],
				[
					{
						id: 9,
						file_name: 'dock.jpg',
						caption: 'Unload photo',
						mime_type: 'image/jpeg',
					},
				],
			),
		);
		const page = await getTrackingPageByToken(TOKEN);
		expect(page.imageAttachments).toEqual([
			{
				url: `/api/tracking/tasks/${TOKEN}/attachments/9`,
				alt: 'Unload photo',
				fileName: 'dock.jpg',
				mimeType: 'image/jpeg',
			},
		]);
	});

	it('omits completion images when the template has no image block', async () => {
		const pool = makeTrackingPool(
			baseTaskRow({
				tracking_page_template: {
					version: 2,
					blocks: [{ id: 'timeline', type: 'history' }],
				},
			}),
		);
		mocks.getPool.mockReturnValue(pool);
		const page = await getTrackingPageByToken(TOKEN);
		expect(page.imageAttachments).toEqual([]);
		expect(
			pool.query.mock.calls.some((call) =>
				String(call[0]).includes('FROM task_attachments'),
			),
		).toBe(false);
	});
});

describe('getTrackingDocument', () => {
	beforeEach(() => {
		mocks.renderPrint.mockReset();
	});

	it('returns 404 for invalid tokens', async () => {
		mocks.getPool.mockReturnValue(makeTrackingPool(null));
		await expect(
			getTrackingDocument('', 'proof_of_completion', async () => null),
		).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 for delivery docket on non-Delivery tasks', async () => {
		mocks.getPool.mockReturnValue(
			makeTrackingPool(baseTaskRow({ task_type: 'Install' })),
		);
		await expect(
			getTrackingDocument(TOKEN, 'delivery_docket', async () => null),
		).rejects.toMatchObject({ status: 404 });
	});

	it('rejects path traversal in stored document keys', async () => {
		mocks.getPool.mockReturnValue({
			query: vi.fn(async (sql: string, params?: unknown[]) => {
				if (sql.includes('FROM tasks') && sql.includes('tracking_token')) {
					return {
						rows: [
							{
								id: 42,
								task_type: 'Delivery',
								status: 'Completed',
							},
						],
						rowCount: 1,
					};
				}
				if (
					sql.includes('FROM task_documents') &&
					params?.[1] === 'proof_of_completion'
				) {
					return {
						rows: [{ storage_key: '../secrets.txt', file_name: 'pod.pdf' }],
						rowCount: 1,
					};
				}
				throw new Error(`Unexpected query: ${sql.slice(0, 120)}`);
			}),
		});

		await expect(
			getTrackingDocument(TOKEN, 'proof_of_completion', async () => null),
		).rejects.toMatchObject({
			message: 'Invalid document path',
			status: 400,
		});
	});
});

describe('getTrackingImageAttachment', () => {
	it('returns the image buffer for a token-scoped photo', async () => {
		const buf = Buffer.from('jpeg-bytes');
		mocks.getObjectBuffer.mockResolvedValue(buf);
		mocks.getPool.mockReturnValue(
			makeTrackingPool(
				baseTaskRow({
					status: 'Completed',
					tracking_page_template: {
						version: 2,
						blocks: [
							{
								id: 'images',
								type: 'imageAttachments',
								tatKeys: ['completion_photos'],
							},
						],
					},
				}),
				[],
				[
					{
						id: 9,
						file_name: 'dock.jpg',
						caption: null,
						mime_type: 'image/jpeg',
						storage_key: 'attachments/42/dock.jpg',
					},
				],
			),
		);
		await expect(getTrackingImageAttachment(TOKEN, 9)).resolves.toEqual({
			buffer: buf,
			fileName: 'dock.jpg',
			mimeType: 'image/jpeg',
		});
	});

	it('returns 404 for a missing image', async () => {
		mocks.getPool.mockReturnValue(makeTrackingPool(baseTaskRow(), [], []));
		await expect(getTrackingImageAttachment(TOKEN, 9)).rejects.toMatchObject({
			status: 404,
		});
	});
});
