/** @vitest-environment node */
import { afterEach, describe, expect, it } from 'vitest';
import {
	generateTrackingToken,
	trackingPath,
	trackingUrl,
} from '../server/trackingToken.mjs';

describe('trackingToken', () => {
	const originalPublicUrl = process.env.PUBLIC_APP_URL;

	afterEach(() => {
		if (originalPublicUrl === undefined) {
			delete process.env.PUBLIC_APP_URL;
		} else {
			process.env.PUBLIC_APP_URL = originalPublicUrl;
		}
	});

	it('generateTrackingToken returns a non-empty base64url string', () => {
		const token = generateTrackingToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(token.length).toBeGreaterThan(20);
	});

	it('trackingPath returns /t/{token}', () => {
		expect(trackingPath('abc123')).toBe('/t/abc123');
		expect(trackingPath('  abc123  ')).toBe('/t/abc123');
		expect(trackingPath('')).toBe('');
	});

	it('trackingUrl uses PUBLIC_APP_URL when set', () => {
		process.env.PUBLIC_APP_URL = 'https://field.example.com/';
		expect(trackingUrl('tok')).toBe('https://field.example.com/t/tok');
	});

	it('trackingUrl returns path only when PUBLIC_APP_URL is unset', () => {
		delete process.env.PUBLIC_APP_URL;
		expect(trackingUrl('tok')).toBe('/t/tok');
	});
});
