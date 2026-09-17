/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloneTask } from '../server/cloneTask.mjs';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
	createTask: vi.fn(),
	listAttachments: vi.fn(),
	copyObject: vi.fn(),
	buildAttachmentStorageKey: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/createTask.mjs', () => ({ createTask: mocks.createTask }));
vi.mock('../server/attachments.mjs', () => ({
	listAttachments: mocks.listAttachments,
}));
vi.mock('../server/storage.mjs', () => ({
	buildAttachmentStorageKey: mocks.buildAttachmentStorageKey,
	copyObject: mocks.copyObject,
}));

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const CREW_A = '660e8400-e29b-41d4-a716-446655440001';
const CREW_B = '770e8400-e29b-41d4-a716-446655440002';

const sourceRow = {
	id: 10,
	task_type: 'Delivery',
	task_type_id: 1,
	description: 'Bring the gear',
	job_title: 'ACME job',
	external_key: 'EXT-1',
	custom_fields: { '1': 'value' },
	custom_field_defs_snapshot: [],
	window_start_at: '2026-09-02T08:00:00.000Z',
	window_end_at: '2026-09-02T12:00:00.000Z',
	destination_address_id: 5,
	destination_address_name: 'Venue',
	destination_address: '1 Main St',
	destination_building: 'B1',
	destination_notes: 'Gate 2',
	contacts: [
		{ id: 1, isPoc: true, receivesEmail: true },
		{ id: 2, isPoc: false, receivesEmail: false },
	],
	crew_members: [
		{ id: CREW_A, isLead: true },
		{ id: CREW_B, isLead: false },
	],
};

function installSourcePool(found = true) {
	mocks.getPool.mockReturnValue({
		query: vi.fn(async (sql: string) => {
			if (sql.includes('FROM tasks t') && sql.includes('WHERE t.id = $1')) {
				return { rows: found ? [sourceRow] : [], rowCount: found ? 1 : 0 };
			}
			if (sql.includes('INSERT INTO task_attachments')) {
				return { rows: [], rowCount: 1 };
			}
			throw new Error(`Unexpected query: ${sql.slice(0, 120)}`);
		}),
	});
}

describe('cloneTask', () => {
	beforeEach(() => {
		mocks.createTask.mockReset();
		mocks.listAttachments.mockReset();
		mocks.copyObject.mockReset();
		mocks.buildAttachmentStorageKey.mockReset();
		mocks.createTask.mockResolvedValue({ id: 99 });
		mocks.listAttachments.mockResolvedValue([]);
		mocks.buildAttachmentStorageKey.mockImplementation(
			(taskId: number, fileName: string) => `attachments/${taskId}/${fileName}`,
		);
	});

	it('returns 404 when the source task is missing', async () => {
		installSourcePool(false);
		await expect(
			cloneTask(10, { createdByUserId: USER_ID }),
		).rejects.toMatchObject({ message: 'Task not found', status: 404 });
	});

	it('honors include flags for contacts, crew, dates, attachments, and external key', async () => {
		installSourcePool();
		mocks.listAttachments.mockResolvedValue([
			{
				id: 1,
				kind: 'photo',
				storageKey: 'attachments/10/photo.jpg',
				mimeType: 'image/jpeg',
				fileName: 'photo.jpg',
				fileSizeBytes: 100,
				caption: null,
			},
		]);
		mocks.copyObject.mockResolvedValue(undefined);

		await cloneTask(10, {
			createdByUserId: USER_ID,
			includeContacts: false,
			includeCrew: false,
			includeDates: false,
			includeAttachments: false,
			includeExternalKey: false,
		});

		expect(mocks.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				contactIds: [],
				pocContactId: null,
				receiveEmailContactIds: [],
				crewMemberIds: [],
				leadCrewMemberId: null,
				afterDateTime: '',
				beforeDateTime: '',
				externalKey: '',
				allowRetiredTaskType: true,
			}),
		);
		expect(mocks.listAttachments).not.toHaveBeenCalled();

		mocks.createTask.mockClear();
		await cloneTask(10, {
			createdByUserId: USER_ID,
			includeContacts: true,
			includeCrew: true,
			includeDates: true,
			includeAttachments: true,
			includeExternalKey: true,
		});

		expect(mocks.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				contactIds: [1, 2],
				pocContactId: 1,
				receiveEmailContactIds: [1],
				crewMemberIds: [CREW_A, CREW_B],
				leadCrewMemberId: CREW_A,
				afterDateTime: '2026-09-02T08:00:00.000Z',
				beforeDateTime: '2026-09-02T12:00:00.000Z',
				externalKey: 'EXT-1',
			}),
		);
		expect(mocks.copyObject).toHaveBeenCalledWith(
			'attachments/10/photo.jpg',
			'attachments/99/photo.jpg',
		);
	});

	it('logs attachment copy failures but still returns the created task', async () => {
		installSourcePool();
		mocks.listAttachments.mockResolvedValue([
			{
				id: 2,
				kind: 'document',
				storageKey: 'attachments/10/doc.pdf',
				mimeType: 'application/pdf',
				fileName: 'doc.pdf',
				fileSizeBytes: 200,
				caption: null,
			},
		]);
		mocks.copyObject.mockRejectedValue(new Error('storage offline'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const created = await cloneTask(10, {
			createdByUserId: USER_ID,
			includeAttachments: true,
		});

		expect(created).toEqual({ id: 99 });
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining('Failed to copy attachment 2'),
			expect.any(Error),
		);
		errorSpy.mockRestore();
	});
});
