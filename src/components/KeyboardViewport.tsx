import { useEffect } from 'react';
import {
	scrollFocusedIntoView,
	useVirtualKeyboard,
} from '../hooks/useVirtualKeyboard';

/**
 * Starts keyboard tracking and scrolls the focused field into the
 * remaining viewport after the shell shrinks.
 */
export function KeyboardViewport() {
	const keyboard = useVirtualKeyboard();

	useEffect(() => {
		if (!keyboard.isOpen || keyboard.height <= 0) return;
		let nested = 0;
		const outer = requestAnimationFrame(() => {
			nested = requestAnimationFrame(() => {
				scrollFocusedIntoView();
			});
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(nested);
		};
	}, [keyboard.isOpen, keyboard.height]);

	return null;
}
