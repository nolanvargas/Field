import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	formatCompactTimeAgo,
	formatDateTime,
	formatShortDateTime,
	formatShortDateTimeWithAgo,
	formatTimeAgo,
} from '../src/formatTime';

describe('formatTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('formatDateTime returns em dash for empty or invalid values', () => {
		expect(formatDateTime(null)).toBe('—');
		expect(formatDateTime('not-a-date')).toBe('—');
	});

	it('formatTimeAgo uses just now within 45 seconds', () => {
		expect(formatTimeAgo('2026-08-12T11:59:30Z')).toBe('just now');
	});

	it('formatTimeAgo uses minute and hour boundaries', () => {
		expect(formatTimeAgo('2026-08-12T11:58:00Z')).toBe('2 minutes ago');
		expect(formatTimeAgo('2026-08-12T11:00:00Z')).toBe('1 hour ago');
		expect(formatTimeAgo('2026-08-10T12:00:00Z')).toBe('2 days ago');
	});

	it('formatTimeAgo prefixes future times with in', () => {
		expect(formatTimeAgo('2026-08-12T13:00:00Z')).toBe('in 1 hour');
	});

	it('formatCompactTimeAgo uses short labels', () => {
		expect(formatCompactTimeAgo('2026-08-12T11:59:30Z')).toBe('now');
		expect(formatCompactTimeAgo('2026-08-12T11:00:00Z')).toBe('1h ago');
		expect(formatCompactTimeAgo('2026-08-10T12:00:00Z')).toBe('2d ago');
		expect(formatCompactTimeAgo('2026-08-12T13:00:00Z')).toBe('in 1h');
	});

	it('formatShortDateTimeWithAgo combines absolute and relative labels', () => {
		const value = '2026-08-12T13:00:00Z';
		expect(formatShortDateTime(value)).toMatch(/\d+\/\d+/);
		expect(formatShortDateTimeWithAgo(value)).toContain('(in 1h)');
	});
});
