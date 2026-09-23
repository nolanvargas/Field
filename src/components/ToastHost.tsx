import { Capacitor } from '@capacitor/core';
import { useMediaQuery } from '@mantine/hooks';
import { Toaster } from 'sonner';

/** Sonner default for top-center is top + invalid "center" — only upward swipe works. */
const TOUCH_SWIPE_DIRECTIONS = ['top', 'right', 'bottom', 'left'] as const;

export function ToastHost() {
	const coarseOrNarrow = useMediaQuery(
		'(max-width: 600px), (hover: none) and (pointer: coarse)',
	);
	const omnidirectionalSwipe =
		Capacitor.isNativePlatform() || coarseOrNarrow;

	return (
		<Toaster
			richColors
			position='top-center'
			swipeDirections={
				omnidirectionalSwipe ? [...TOUCH_SWIPE_DIRECTIONS] : undefined
			}
		/>
	);
}
