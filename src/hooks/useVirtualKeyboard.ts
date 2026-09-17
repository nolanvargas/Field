import { useLayoutEffect, useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

export type VirtualKeyboardState = {
	isOpen: boolean;
	height: number;
};

const CLOSED: VirtualKeyboardState = { isOpen: false, height: 0 };

let state: VirtualKeyboardState = CLOSED;
const listeners = new Set<() => void>();
let started = false;
let pluginHeight = 0;
let viewportInset = 0;

function emit() {
	for (const listener of listeners) listener();
}

function syncKeyboardCss(next: VirtualKeyboardState) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.style.setProperty('--field-keyboard-inset', `${next.height}px`);
	if (next.isOpen && next.height > 0) {
		root.setAttribute('data-keyboard-open', '');
	} else {
		root.removeAttribute('data-keyboard-open');
	}
}

function setState(next: VirtualKeyboardState) {
	if (state.isOpen === next.isOpen && state.height === next.height) return;
	state = next;
	syncKeyboardCss(next);
	emit();
}

function publish() {
	const height = mergeKeyboardHeights(pluginHeight, viewportInset);
	const capped =
		typeof window === 'undefined'
			? height
			: Math.min(height, Math.round(window.innerHeight * 0.75));
	setState(capped > 0 ? { isOpen: true, height: capped } : CLOSED);
}

/** Ignore small chrome/toolbar shrinks when using visualViewport. */
export const VIEWPORT_KEYBOARD_THRESHOLD_PX = 120;

/** Layout viewport minus visualViewport — the covered bottom strip. */
export function visualViewportInset(
	innerHeight: number,
	visualHeight: number,
	offsetTop: number,
): number {
	return Math.max(0, innerHeight - visualHeight - offsetTop);
}

/** Prefer the larger of the Capacitor keyboard height and visualViewport inset. */
export function mergeKeyboardHeights(
	nativePluginHeight: number,
	viewportInsetPx: number,
): number {
	const fromViewport =
		viewportInsetPx > VIEWPORT_KEYBOARD_THRESHOLD_PX ? viewportInsetPx : 0;
	return Math.max(nativePluginHeight, fromViewport);
}

export function scrollFocusedIntoView(): void {
	const el = document.activeElement;
	if (
		!(el instanceof HTMLElement) ||
		el === document.body ||
		el === document.documentElement
	) {
		return;
	}
	el.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function startVisualViewportFallback() {
	const vv = window.visualViewport;
	if (!vv) return;

	const update = () => {
		viewportInset = visualViewportInset(
			window.innerHeight,
			vv.height,
			vv.offsetTop,
		);
		publish();
	};

	vv.addEventListener('resize', update);
	vv.addEventListener('scroll', update);
	update();
}

function startNativeListeners() {
	void Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {
		/* Android may not support setResizeMode; config handles iOS. */
	});

	void Keyboard.addListener('keyboardWillShow', (info) => {
		pluginHeight = info.keyboardHeight;
		publish();
	});
	void Keyboard.addListener('keyboardDidShow', (info) => {
		pluginHeight = info.keyboardHeight;
		publish();
	});
	void Keyboard.addListener('keyboardWillHide', () => {
		pluginHeight = 0;
		publish();
	});
	void Keyboard.addListener('keyboardDidHide', () => {
		pluginHeight = 0;
		publish();
	});
}

function ensureStarted() {
	if (started || typeof window === 'undefined') return;
	started = true;

	if (Capacitor.isNativePlatform()) {
		startNativeListeners();
	} else {
		startVisualViewportFallback();
	}
}

/**
 * Tracks soft-keyboard open state and height.
 * Native: @capacitor/keyboard merged with visualViewport.
 * Web: visualViewport inset heuristic.
 */
export function useVirtualKeyboard(): VirtualKeyboardState {
	useLayoutEffect(() => {
		ensureStarted();
	}, []);

	return useSyncExternalStore(
		(onStoreChange) => {
			listeners.add(onStoreChange);
			return () => {
				listeners.delete(onStoreChange);
			};
		},
		() => state,
		() => CLOSED,
	);
}
