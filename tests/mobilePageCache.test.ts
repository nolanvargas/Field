import { describe, expect, it } from 'vitest';
import {
	getMobileCacheKey,
	isMobileLiveRoute,
	isMobileOverlayRoute,
} from '../src/mobilePageCache';

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

	it('renders uncached paths live so home redirect and Development mount', () => {
		expect(isMobileLiveRoute('/')).toBe(true);
		expect(isMobileLiveRoute('/development')).toBe(true);
		expect(isMobileLiveRoute('/development/tests')).toBe(true);
		expect(isMobileLiveRoute('/my-tasks')).toBe(false);
		expect(isMobileLiveRoute('/task/42')).toBe(false);
	});
});
