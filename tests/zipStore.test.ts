import { describe, expect, it } from 'vitest';
import { uniqueZipFileName, zipStoreFiles } from '../src/zipStore';

describe('uniqueZipFileName', () => {
	it('keeps the first name and suffixes duplicates', () => {
		const used = new Set<string>();
		expect(uniqueZipFileName('dock.jpg', used)).toBe('dock.jpg');
		expect(uniqueZipFileName('dock.jpg', used)).toBe('dock-2.jpg');
		expect(uniqueZipFileName('dock.jpg', used)).toBe('dock-3.jpg');
	});
});

describe('zipStoreFiles', () => {
	it('writes a store-method zip with the file name', async () => {
		const payload = new TextEncoder().encode('photo');
		const blob = zipStoreFiles([{ name: 'site-photo.jpg', data: payload }]);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
		const name = 'site-photo.jpg';
		const named = new TextDecoder().decode(bytes);
		expect(named).toContain(name);
		expect(named).toContain('photo');
	});
});
