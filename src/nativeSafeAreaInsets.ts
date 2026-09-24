import { Capacitor } from '@capacitor/core';

const PROBE_ID = 'field-safe-area-probe';

function readEnvInsetsPx(): { top: number; bottom: number } {
	if (typeof document === 'undefined') return { top: 0, bottom: 0 };

	let probe = document.getElementById(PROBE_ID);
	if (!probe) {
		probe = document.createElement('div');
		probe.id = PROBE_ID;
		probe.setAttribute('aria-hidden', 'true');
		probe.style.cssText =
			'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;width:0;height:0;' +
			'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);';
		document.body.appendChild(probe);
	}

	const style = getComputedStyle(probe);
	return {
		top: parseFloat(style.paddingTop) || 0,
		bottom: parseFloat(style.paddingBottom) || 0,
	};
}

/** Rough dp→px when WebView reports env(safe-area-inset-*) as 0 (common on Android). */
function androidFallbackInsetsPx(): { top: number; bottom: number } {
	const dpr = window.devicePixelRatio || 1;
	return {
		top: Math.round(24 * dpr),
		bottom: Math.round(48 * dpr),
	};
}

function publish(top: number, bottom: number) {
	const root = document.documentElement;
	root.style.setProperty('--field-auth-safe-area-top', `${top}px`);
	root.style.setProperty('--field-auth-safe-area-bottom', `${bottom}px`);
}

function sync() {
	const env = readEnvInsetsPx();
	let top = env.top;
	let bottom = env.bottom;

	if (
		Capacitor.getPlatform() === 'android' &&
		top <= 0 &&
		bottom <= 0
	) {
		const fallback = androidFallbackInsetsPx();
		top = fallback.top;
		bottom = fallback.bottom;
	}

	if (top > 0 || bottom > 0) {
		publish(top, bottom);
	}
}

let started = false;

/** Auth screen only — do not set global shell insets (AppShell uses env()). */
export function startNativeSafeAreaInsets(): void {
	if (started || !Capacitor.isNativePlatform()) return;
	started = true;

	document.documentElement.dataset.capacitorPlatform = Capacitor.getPlatform();

	const run = () => sync();
	run();

	window.addEventListener('resize', run);
	window.visualViewport?.addEventListener('resize', run);
	window.visualViewport?.addEventListener('scroll', run);

	// MainActivity may set vars after first paint; re-check briefly.
	let attempts = 0;
	const interval = window.setInterval(() => {
		run();
		attempts += 1;
		if (attempts >= 20) window.clearInterval(interval);
	}, 250);
}
