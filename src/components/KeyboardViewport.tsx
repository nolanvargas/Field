import { useEffect } from 'react';
import { scrollFocusedIntoView } from '../scrollFocusedField';

/**
 * Nudge focused fields into view after the IME opens (native resize is async).
 */
export function KeyboardViewport() {
	useEffect(() => {
		const onFocusIn = (event: FocusEvent) => {
			const target = event.target;
			if (
				!(target instanceof HTMLElement) ||
				!target.matches(
					'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
				)
			) {
				return;
			}
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					scrollFocusedIntoView();
				});
			});
		};

		document.addEventListener('focusin', onFocusIn);
		return () => document.removeEventListener('focusin', onFocusIn);
	}, []);

	return null;
}
