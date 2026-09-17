import { useEffect, useEffectEvent } from 'react';
import { useMantineColorScheme } from '@mantine/core';

const ARROW_CODES = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export type ArrowChordKeyEvent = {
	code: string;
	preventDefault?: () => void;
};

/** Fires `onChord` once when all four arrow keys are held, until one is released. */
export function createArrowChordTracker(onChord: () => void) {
	const held = new Set<string>();
	let latched = false;

	function onKeyDown(event: ArrowChordKeyEvent) {
		if (!ARROW_CODES.has(event.code)) return;
		held.add(event.code);
		if (held.size !== 4) return;
		event.preventDefault?.();
		if (latched) return;
		latched = true;
		onChord();
	}

	function onKeyUp(event: ArrowChordKeyEvent) {
		if (!ARROW_CODES.has(event.code)) return;
		held.delete(event.code);
		if (held.size < 4) latched = false;
	}

	function reset() {
		held.clear();
		latched = false;
	}

	return { onKeyDown, onKeyUp, reset };
}

/** Hold all four arrow keys to toggle light/dark. */
export function useArrowChordColorSchemeToggle() {
	const { toggleColorScheme } = useMantineColorScheme();
	const onChord = useEffectEvent(() => {
		toggleColorScheme();
	});

	useEffect(() => {
		const tracker = createArrowChordTracker(() => onChord());
		const onKeyDown = (event: KeyboardEvent) => tracker.onKeyDown(event);
		const onKeyUp = (event: KeyboardEvent) => tracker.onKeyUp(event);
		const onHidden = () => {
			if (document.visibilityState !== 'visible') tracker.reset();
		};

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('blur', tracker.reset);
		document.addEventListener('visibilitychange', onHidden);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('blur', tracker.reset);
			document.removeEventListener('visibilitychange', onHidden);
		};
	}, []);
}
