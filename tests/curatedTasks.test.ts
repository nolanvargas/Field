import { describe, expect, it } from 'vitest';
import {
	bulkCountForCurated,
} from '../scripts/lib/curatedTasks.mjs';
import {
	curatedAttachmentByteSize,
	pickCuratedAttachmentStorageKey,
	pickCuratedDemoAttachmentStorageKey,
} from '../shared/curatedAttachmentPool.mjs';
import {
	materializeCuratedFixtureToSeedTask,
	materializeOffset,
	offsetMsFromIso,
} from '../shared/curatedTasks.mjs';

describe('curatedTasks offsets', () => {
	it('round-trips offset through materialize', () => {
		const capturedAt = '2026-09-17T12:00:00.000Z';
		const value = '2026-09-17T10:30:00.000Z';
		const offsetMs = offsetMsFromIso(capturedAt, value);
		expect(offsetMs).toBe(-90 * 60 * 1000);
		const anchorMs = Date.parse('2026-09-20T12:00:00.000Z');
		expect(materializeOffset(anchorMs, { offsetMs })).toBe(
			'2026-09-20T10:30:00.000Z',
		);
	});

	it('materializes fixture task at anchor', () => {
		const anchorMs = Date.parse('2026-09-20T00:00:00.000Z');
		const fixture = {
			schemaVersion: 1,
			slug: 'sample',
			seedId: 1,
			capturedAt: '2026-09-17T00:00:00.000Z',
			task: {
				taskType: 'Delivery',
				status: 'Assigned',
				description: 'Title\nBody',
				jobTitle: 'Title',
				externalKey: '1',
				createdByUserId: 'a1111111-1111-4111-8111-111111111111',
				crewSize: 2,
				hours: 1,
				isTimeSpecific: false,
				canStartEarly: false,
				destination: { addressId: 125 },
				crew: [],
				contacts: [{ contactId: 117, isPoc: true }],
			},
			times: {
				createdAt: { offsetMs: 0 },
				updatedAt: { offsetMs: 0 },
				windowStartAt: { offsetMs: 3600000 },
				windowEndAt: { offsetMs: 7200000 },
			},
			crewEvents: [],
			completionNotes: [],
			attachments: [],
			documents: [],
			emails: [],
			history: [],
		};
		const seed = materializeCuratedFixtureToSeedTask(fixture, anchorMs, {
			storageKeyForFileRef: () => 'attachments/curated/test.jpg',
		});
		expect(seed.id).toBe(1);
		expect(seed.createdAt).toBe(new Date(anchorMs).toISOString());
		expect(seed.windowStart).toBe(
			new Date(anchorMs + 3600000).toISOString(),
		);
	});

	it('computes bulk filler count', () => {
		expect(bulkCountForCurated(500, 30)).toBe(470);
		expect(bulkCountForCurated(100, 25)).toBe(75);
		expect(() => bulkCountForCurated(10, 20)).toThrow(/exceeds target/);
	});
});

describe('curatedAttachmentPool', () => {
	it('picks real curated files for generated task attachments', () => {
		const key = pickCuratedAttachmentStorageKey('photo', 7);
		expect(key.startsWith('attachments/curated/')).toBe(true);
		expect(curatedAttachmentByteSize(key)).toBeGreaterThan(1000);

		const demoKey = pickCuratedDemoAttachmentStorageKey('photo', 7);
		expect(demoKey.startsWith('demo/curated/')).toBe(true);
		expect(curatedAttachmentByteSize(demoKey)).toBeGreaterThan(1000);
	});
});

describe('curated file dedup', () => {
	it('reuses one manifest entry for shared fileRef', () => {
		const files = {
			abc: {
				storageKey: 'attachments/curated/abc.jpg',
				relativePath: 'abc.jpg',
				mimeType: 'image/jpeg',
				fileName: 'a.jpg',
				byteSize: 10,
			},
		};
		const anchorMs = Date.now();
		const baseFixture = {
			task: {
				taskType: 'Delivery',
				status: 'Completed',
				description: 'A',
				createdByUserId: 'x',
				destination: {},
				crew: [],
				contacts: [],
			},
			times: { createdAt: { offsetMs: 0 }, updatedAt: { offsetMs: 0 } },
			attachments: [
				{
					fileRef: 'abc',
					kind: 'photo',
					mimeType: 'image/jpeg',
					fileName: 'a.jpg',
					uploadedByUserId: 'x',
					at: { offsetMs: 0 },
				},
			],
		};
		const a = materializeCuratedFixtureToSeedTask(
			{ ...baseFixture, seedId: 1 },
			anchorMs,
			{ storageKeyForFileRef: (ref) => files[ref as keyof typeof files].storageKey },
		);
		const b = materializeCuratedFixtureToSeedTask(
			{ ...baseFixture, seedId: 2 },
			anchorMs,
			{ storageKeyForFileRef: (ref) => files[ref as keyof typeof files].storageKey },
		);
		expect(a.attachments?.[0]?.storageKey).toBe(b.attachments?.[0]?.storageKey);
	});
});
