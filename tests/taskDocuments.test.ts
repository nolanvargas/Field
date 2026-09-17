/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
	putLocalObject: vi.fn(),
	isS3Enabled: vi.fn(() => false),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

vi.mock('../server/storage.mjs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../server/storage.mjs')>();
	return {
		...actual,
		putLocalObject: storageMocks.putLocalObject,
		isS3Enabled: storageMocks.isS3Enabled,
	};
});

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('storeTaskDocumentPdf', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
		storageMocks.putLocalObject.mockReset();
		storageMocks.putLocalObject.mockResolvedValue(undefined);
		storageMocks.isS3Enabled.mockReturnValue(false);
	});

	it('stores the PDF locally and upserts task_documents on (task_id, kind)', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

		const { storeTaskDocumentPdf } = await import('../server/taskDocuments.mjs');
		const buffer = Buffer.from('%PDF-1.4');
		const result = await storeTaskDocumentPdf({
			taskId: 7,
			kind: 'delivery_docket',
			storageKey: 'documents/7/delivery_docket.pdf',
			fileName: 'docket.pdf',
			buffer,
			generatedByUserId: USER_ID,
		});

		expect(storageMocks.putLocalObject).toHaveBeenCalledWith(
			'documents/7/delivery_docket.pdf',
			buffer,
			'application/pdf',
		);
		expect(result.storageKey).toBe('documents/7/delivery_docket.pdf');
		expect(dbMocks.query).toHaveBeenCalledOnce();
		expect(String(dbMocks.query.mock.calls[0][0])).toContain(
			'ON CONFLICT (task_id, kind) DO UPDATE',
		);
		expect(dbMocks.query.mock.calls[0][1]).toEqual([
			7,
			'delivery_docket',
			'documents/7/delivery_docket.pdf',
			'docket.pdf',
			USER_ID,
		]);
	});
});
