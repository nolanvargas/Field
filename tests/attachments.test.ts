/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	ALLOWED_MIME_TYPES,
	MAX_ATTACHMENT_BYTES,
	MAX_VIDEO_ATTACHMENT_BYTES,
	kindFromMimeType,
	maxBytesForMimeType,
	normalizeMimeType,
	oversizeErrorMessage,
} from '../shared/attachments.js';
import { validateAttachmentFile } from '../src/api/attachments';
import { confirmAttachment, createPresign } from '../server/attachments.mjs';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
	localObjectExists: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/storage.mjs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../server/storage.mjs')>();
	return {
		...actual,
		localObjectExists: mocks.localObjectExists,
		presignPut: vi.fn(async ({ storageKey }: { storageKey: string }) => ({
			uploadUrl: `http://local/upload/${storageKey}`,
		})),
	};
});

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeFile(
	name: string,
	size: number,
	type = '',
): File {
	const buffer = new Uint8Array(Math.max(size, 1));
	return new File([buffer], name, { type });
}

describe('shared/attachments', () => {
	it('normalizeMimeType strips parameters and lowercases', () => {
		expect(normalizeMimeType('VIDEO/MP4; codecs=avc1')).toBe('video/mp4');
		expect(normalizeMimeType('  image/jpeg ; charset=utf-8 ')).toBe('image/jpeg');
	});

	it('maxBytesForMimeType uses 25 MB for non-video and 150 MB for video', () => {
		expect(maxBytesForMimeType('image/jpeg')).toBe(MAX_ATTACHMENT_BYTES);
		expect(maxBytesForMimeType('application/pdf')).toBe(MAX_ATTACHMENT_BYTES);
		expect(maxBytesForMimeType('video/mp4')).toBe(MAX_VIDEO_ATTACHMENT_BYTES);
		expect(maxBytesForMimeType('video/mp4; codecs=avc1')).toBe(
			MAX_VIDEO_ATTACHMENT_BYTES,
		);
	});

	it('kindFromMimeType maps image, video, and document', () => {
		expect(kindFromMimeType('image/png')).toBe('photo');
		expect(kindFromMimeType('video/webm')).toBe('video');
		expect(kindFromMimeType('application/pdf')).toBe('document');
		expect(kindFromMimeType('text/plain')).toBe('document');
	});

	it('oversizeErrorMessage differs for video vs other types', () => {
		expect(oversizeErrorMessage('image/jpeg', MAX_ATTACHMENT_BYTES)).toBe(
			'File exceeds 25 MB limit',
		);
		expect(oversizeErrorMessage('video/mp4', MAX_VIDEO_ATTACHMENT_BYTES)).toBe(
			'Video exceeds 150 MB. Record at a lower resolution (try 1080p) if possible.',
		);
	});
});

describe('validateAttachmentFile (client)', () => {
	it('rejects empty files', () => {
		const file = makeFile('photo.jpg', 0, 'image/jpeg');
		Object.defineProperty(file, 'size', { value: 0 });
		expect(validateAttachmentFile(file)).toBe('“photo.jpg” is empty');
	});

	it('rejects disallowed MIME types', () => {
		const file = makeFile('evil.exe', 100, 'application/x-msdownload');
		expect(validateAttachmentFile(file)).toBe(
			'Unsupported or unknown file type: evil.exe',
		);
	});

	it('rejects oversize images with the shared oversize message', () => {
		const file = makeFile('big.jpg', MAX_ATTACHMENT_BYTES + 1, 'image/jpeg');
		expect(validateAttachmentFile(file)).toBe(
			oversizeErrorMessage('image/jpeg', MAX_ATTACHMENT_BYTES),
		);
	});

	it('rejects oversize videos with the shared oversize message', () => {
		const file = makeFile('big.mp4', MAX_VIDEO_ATTACHMENT_BYTES + 1, 'video/mp4');
		expect(validateAttachmentFile(file)).toBe(
			oversizeErrorMessage('video/mp4', MAX_VIDEO_ATTACHMENT_BYTES),
		);
	});

	it('accepts allowed types within size limits', () => {
		const file = makeFile('note.pdf', 1024, 'application/pdf');
		expect(validateAttachmentFile(file)).toBeNull();
	});
});

describe('createPresign (API)', () => {
	beforeEach(() => {
		mocks.getPool.mockReset();
		mocks.getPool.mockReturnValue({
			query: vi.fn(async (sql: string) => {
				if (sql.includes('FROM tasks WHERE id')) {
					return { rows: [{ id: 1 }], rowCount: 1 };
				}
				if (sql.includes('FROM users WHERE id')) {
					return { rows: [{ id: USER_ID }], rowCount: 1 };
				}
				throw new Error(`Unexpected query: ${sql}`);
			}),
		});
	});

	it('normalizes MIME with codecs before validation', async () => {
		await expect(
			createPresign(
				1,
				{
					fileName: 'clip.mp4',
					mimeType: 'video/mp4; codecs=avc1',
					fileSizeBytes: 1024,
				},
				USER_ID,
			),
		).resolves.toMatchObject({ mimeType: 'video/mp4', uploadedByUserId: USER_ID });
	});

	it('rejects disallowed MIME types', async () => {
		await expect(
			createPresign(
				1,
				{
					fileName: 'evil.exe',
					mimeType: 'application/x-msdownload',
					fileSizeBytes: 100,
				},
				USER_ID,
			),
		).rejects.toMatchObject({
			message: 'Unsupported file type: application/x-msdownload',
			status: 400,
		});
	});

	it('rejects oversize files with the same message as the client', async () => {
		const mimeType = 'video/mp4';
		const maxBytes = maxBytesForMimeType(mimeType);
		await expect(
			createPresign(
				1,
				{
					fileName: 'big.mp4',
					mimeType,
					fileSizeBytes: maxBytes + 1,
				},
				USER_ID,
			),
		).rejects.toMatchObject({
			message: oversizeErrorMessage(mimeType, maxBytes),
			status: 400,
		});
	});

	it('uses session-bound uploader id, not body', async () => {
		const sessionUser = '660e8400-e29b-41d4-a716-446655440001';
		const result = await createPresign(
			1,
			{
				fileName: 'photo.jpg',
				mimeType: 'image/jpeg',
				fileSizeBytes: 1024,
				uploadedByUserId: USER_ID,
			},
			sessionUser,
		);
		expect(result.uploadedByUserId).toBe(sessionUser);
	});

	it('allows MIME types in the shared allow-list', () => {
		for (const mime of ALLOWED_MIME_TYPES) {
			expect(ALLOWED_MIME_TYPES.has(normalizeMimeType(mime))).toBe(true);
		}
	});
});

describe('confirmAttachment (API)', () => {
	beforeEach(() => {
		mocks.getPool.mockReset();
		mocks.localObjectExists.mockReset();
		mocks.localObjectExists.mockResolvedValue(true);
		mocks.getPool.mockReturnValue({
			query: vi.fn(async (sql: string) => {
				if (sql.includes('FROM tasks WHERE id')) {
					return { rows: [{ id: 5 }], rowCount: 1 };
				}
				if (sql.includes('INSERT INTO task_attachments')) {
					return { rows: [{ id: 99 }], rowCount: 1 };
				}
				if (sql.includes('FROM task_attachments a')) {
					return {
						rows: [
							{
								id: 99,
								task_id: 5,
								kind: 'photo',
								storage_key: 'attachments/5/abc-photo.jpg',
								mime_type: 'image/jpeg',
								file_name: 'photo.jpg',
								file_size_bytes: 1024,
								caption: null,
								created_at: new Date('2026-08-12T10:00:00Z'),
								uploaded_by_user_id: USER_ID,
								attachment_type_id: null,
								uploaded_by_name: 'Uploader',
								attachment_type_slug: null,
								attachment_type_label: null,
							},
						],
						rowCount: 1,
					};
				}
				throw new Error(`Unexpected query: ${sql}`);
			}),
		});
	});

	it('rejects storage keys that do not belong to the task', async () => {
		await expect(
			confirmAttachment(
				5,
				{
					storageKey: 'attachments/99/abc-photo.jpg',
					fileName: 'photo.jpg',
					mimeType: 'image/jpeg',
					fileSizeBytes: 1024,
				},
				USER_ID,
			),
		).rejects.toMatchObject({
			message: 'Invalid storageKey for task',
			status: 400,
		});
	});

	it('confirms a valid upload for the task storage key', async () => {
		const attachment = await confirmAttachment(
			5,
			{
				storageKey: 'attachments/5/abc-photo.jpg',
				fileName: 'photo.jpg',
				mimeType: 'image/jpeg',
				fileSizeBytes: 1024,
			},
			USER_ID,
		);

		expect(mocks.localObjectExists).toHaveBeenCalledWith('attachments/5/abc-photo.jpg');
		expect(attachment).toMatchObject({
			taskId: 5,
			kind: 'photo',
			storageKey: 'attachments/5/abc-photo.jpg',
			uploadedByName: 'Uploader',
		});
	});
});
