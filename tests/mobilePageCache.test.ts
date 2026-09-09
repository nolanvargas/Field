import { describe, expect, it } from 'vitest';
import { getMobileCacheKey, isMobileOverlayRoute } from '../src/mobilePageCache';

describe('mobilePageCache', () => {
	it('returns cache keys for main tab routes', () => {
		expect(getMobileCacheKey('/my-tasks')).toBe('/my-tasks');
		expect(getMobileCacheKey('/contacts')).toBe('/contacts');
	});

	it('does not cache task detail routes', () => {
		expect(getMobileCacheKey('/task/42')).toBeNull();
	});

	it('detects overlay task routes', () => {
		expect(isMobileOverlayRoute('/task/42')).toBe(true);
		expect(isMobileOverlayRoute('/task/42/complete')).toBe(true);
		expect(isMobileOverlayRoute('/task/42/deliver')).toBe(true);
		expect(isMobileOverlayRoute('/my-tasks')).toBe(false);
	});
});
