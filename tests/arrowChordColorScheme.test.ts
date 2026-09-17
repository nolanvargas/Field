import { describe, expect, it, vi } from 'vitest';
import { createArrowChordTracker } from '../src/arrowChordColorScheme';

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;

function key(code: string) {
	return { code, preventDefault: vi.fn() };
}

describe('createArrowChordTracker', () => {
	it('does not fire until all four arrows are down', () => {
		const onChord = vi.fn();
		const tracker = createArrowChordTracker(onChord);

		tracker.onKeyDown(key('ArrowUp'));
		tracker.onKeyDown(key('ArrowDown'));
		tracker.onKeyDown(key('ArrowLeft'));
		expect(onChord).not.toHaveBeenCalled();

		tracker.onKeyDown(key('ArrowRight'));
		expect(onChord).toHaveBeenCalledTimes(1);
	});

	it('fires once while all four stay held, including key repeats', () => {
		const onChord = vi.fn();
		const tracker = createArrowChordTracker(onChord);

		for (const code of ARROWS) tracker.onKeyDown(key(code));
		expect(onChord).toHaveBeenCalledTimes(1);

		tracker.onKeyDown(key('ArrowUp'));
		tracker.onKeyDown(key('ArrowRight'));
		expect(onChord).toHaveBeenCalledTimes(1);
	});

	it('can fire again after one arrow is released and pressed', () => {
		const onChord = vi.fn();
		const tracker = createArrowChordTracker(onChord);

		for (const code of ARROWS) tracker.onKeyDown(key(code));
		tracker.onKeyUp(key('ArrowUp'));
		tracker.onKeyDown(key('ArrowUp'));
		expect(onChord).toHaveBeenCalledTimes(2);
	});

	it('prevents default on the chord keydown', () => {
		const tracker = createArrowChordTracker(() => {});
		const fourth = key('ArrowRight');

		tracker.onKeyDown(key('ArrowUp'));
		tracker.onKeyDown(key('ArrowDown'));
		tracker.onKeyDown(key('ArrowLeft'));
		tracker.onKeyDown(fourth);

		expect(fourth.preventDefault).toHaveBeenCalledTimes(1);
	});

	it('ignores non-arrow keys', () => {
		const onChord = vi.fn();
		const tracker = createArrowChordTracker(onChord);

		for (const code of ARROWS.slice(0, 3)) tracker.onKeyDown(key(code));
		tracker.onKeyDown(key('KeyA'));
		expect(onChord).not.toHaveBeenCalled();
	});

	it('clears held keys on reset so a later chord can fire', () => {
		const onChord = vi.fn();
		const tracker = createArrowChordTracker(onChord);

		for (const code of ARROWS) tracker.onKeyDown(key(code));
		tracker.reset();
		for (const code of ARROWS) tracker.onKeyDown(key(code));
		expect(onChord).toHaveBeenCalledTimes(2);
	});
});
