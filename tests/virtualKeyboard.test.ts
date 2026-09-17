import { describe, expect, it, vi } from 'vitest';
import {
	VIEWPORT_KEYBOARD_THRESHOLD_PX,
	mergeKeyboardHeights,
	scrollFocusedIntoView,
	visualViewportInset,
} from '../src/hooks/useVirtualKeyboard';

describe('visualViewportInset', () => {
	it('is the covered strip below the visual viewport', () => {
		expect(visualViewportInset(800, 500, 0)).toBe(300);
		expect(visualViewportInset(800, 500, 20)).toBe(280);
	});

	it('does not go negative', () => {
		expect(visualViewportInset(800, 800, 0)).toBe(0);
		expect(visualViewportInset(800, 900, 0)).toBe(0);
	});
});

describe('mergeKeyboardHeights', () => {
	it('uses the plugin height when the viewport has not shrunk yet', () => {
		expect(mergeKeyboardHeights(400, 0)).toBe(400);
	});

	it('uses the visual viewport when the plugin has not fired', () => {
		expect(mergeKeyboardHeights(0, 360)).toBe(360);
	});

	it('ignores small chrome shrinks', () => {
		expect(mergeKeyboardHeights(0, VIEWPORT_KEYBOARD_THRESHOLD_PX)).toBe(0);
		expect(mergeKeyboardHeights(0, VIEWPORT_KEYBOARD_THRESHOLD_PX - 1)).toBe(
			0,
		);
	});

	it('keeps the larger of the two sources', () => {
		expect(mergeKeyboardHeights(400, 360)).toBe(400);
		expect(mergeKeyboardHeights(320, 410)).toBe(410);
	});
});

describe('scrollFocusedIntoView', () => {
	it('scrolls the focused field', () => {
		const input = document.createElement('input');
		const spy = vi.fn();
		input.scrollIntoView = spy;
		document.body.appendChild(input);
		input.focus();
		scrollFocusedIntoView();
		expect(spy).toHaveBeenCalledWith({
			block: 'center',
			inline: 'nearest',
		});
		input.remove();
	});

	it('does nothing when body is focused', () => {
		document.body.focus();
		expect(() => scrollFocusedIntoView()).not.toThrow();
	});
});
