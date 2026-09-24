import { describe, expect, it, vi } from 'vitest';
import { scrollFocusedIntoView } from '../src/scrollFocusedField';

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

	it('uses nearest scroll on More page fields', () => {
		const page = document.createElement('div');
		page.className = 'field-more-page';
		const input = document.createElement('input');
		const spy = vi.fn();
		input.scrollIntoView = spy;
		page.appendChild(input);
		document.body.appendChild(page);
		input.focus();
		scrollFocusedIntoView();
		expect(spy).toHaveBeenCalledWith({
			block: 'nearest',
			inline: 'nearest',
		});
		page.remove();
	});
});
