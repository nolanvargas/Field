/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	normalizeOrgLogoMimeType,
	orgLogoPublicPath,
	ORG_LOGO_MAX_BYTES,
} from '../shared/orgLogo.js';
import { orgLogoMetaFromRow, orgLogoUrl } from '../server/orgLogo.mjs';

describe('orgLogo shared helpers', () => {
	it('normalizes image/jpg to image/jpeg', () => {
		expect(normalizeOrgLogoMimeType('image/jpg')).toBe('image/jpeg');
		expect(normalizeOrgLogoMimeType('image/png')).toBe('image/png');
		expect(normalizeOrgLogoMimeType('text/plain')).toBeNull();
	});

	it('builds a cache-busted public path from updated_at', () => {
		const path = orgLogoPublicPath('2026-01-15T12:00:00.000Z');
		expect(path).toMatch(/^\/api\/org\/logo\?v=\d+$/);
	});

	it('returns null public path when updated_at is missing', () => {
		expect(orgLogoPublicPath(null)).toBeNull();
	});

	it('orgLogoMetaFromRow requires storage key, mime, and updated_at', () => {
		expect(
			orgLogoMetaFromRow({
				logo_storage_key: 'org-branding/logo',
				logo_mime_type: 'image/png',
				logo_updated_at: new Date('2026-01-01T00:00:00.000Z'),
			}),
		).toEqual({
			storageKey: 'org-branding/logo',
			mimeType: 'image/png',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		expect(orgLogoMetaFromRow({ logo_storage_key: null })).toBeNull();
	});
});

describe('orgLogoUrl', () => {
	it('returns null when meta is missing', () => {
		expect(orgLogoUrl(null)).toBeNull();
	});

	it('returns public API path when meta is present', () => {
		const url = orgLogoUrl({
			storageKey: 'org-branding/logo',
			mimeType: 'image/png',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
		expect(url).toBe(`/api/org/logo?v=${new Date('2026-01-01T00:00:00.000Z').getTime()}`);
	});
});

describe('ORG_LOGO_MAX_BYTES', () => {
	it('is 1 MB', () => {
		expect(ORG_LOGO_MAX_BYTES).toBe(1024 * 1024);
	});
});
