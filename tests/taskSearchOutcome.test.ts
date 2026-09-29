import { describe, expect, it } from 'vitest';
import { resolveTaskSearchOutcome } from '../src/taskSearchOutcome';

describe('resolveTaskSearchOutcome', () => {
	it('opens the task when one match is the first result', () => {
		expect(resolveTaskSearchOutcome(1, false)).toBe('task');
	});

	it('opens the list when more than one task matches', () => {
		expect(resolveTaskSearchOutcome(2, false)).toBe('results');
	});

	it('reports not found only while the list is closed', () => {
		expect(resolveTaskSearchOutcome(0, false)).toBe('not-found');
		expect(resolveTaskSearchOutcome(0, true)).toBe('results');
	});

	it('keeps the list open when a later search has one match', () => {
		expect(resolveTaskSearchOutcome(1, true)).toBe('results');
	});
});