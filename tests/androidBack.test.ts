import { beforeEach, describe, expect, it, vi } from 'vitest';

const backButtonListeners: Array<(event: { canGoBack: boolean }) => void> = [];

const capacitorMocks = vi.hoisted(() => ({
	isNativePlatform: vi.fn(() => true),
}));

const appMocks = vi.hoisted(() => ({
	addListener: vi.fn(
		async (_event: string, cb: (event: { canGoBack: boolean }) => void) => {
			backButtonListeners.push(cb);
			return { remove: vi.fn() };
		},
	),
	exitApp: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: capacitorMocks.isNativePlatform,
	},
}));

vi.mock('@capacitor/app', () => ({
	App: appMocks,
}));

describe('androidBack', () => {
	beforeEach(() => {
		vi.resetModules();
		backButtonListeners.length = 0;
		appMocks.addListener.mockClear();
		appMocks.exitApp.mockClear();
		capacitorMocks.isNativePlatform.mockReturnValue(true);
	});

	it('dispatches registered handlers in LIFO order', async () => {
		const { registerAndroidBackHandler, initAndroidBackButton } = await import(
			'../src/androidBack'
		);
		await initAndroidBackButton();

		const order: number[] = [];
		const unregisterFirst = registerAndroidBackHandler(() => order.push(1));
		registerAndroidBackHandler(() => order.push(2));

		const listener = backButtonListeners[0];
		listener({ canGoBack: false });
		expect(order).toEqual([2]);

		unregisterFirst();
		listener({ canGoBack: false });
		expect(order).toEqual([2, 2]);
	});

	it('only registers the Capacitor listener once', async () => {
		const { initAndroidBackButton } = await import('../src/androidBack');
		await initAndroidBackButton();
		await initAndroidBackButton();

		expect(appMocks.addListener).toHaveBeenCalledTimes(1);
		expect(appMocks.addListener).toHaveBeenCalledWith(
			'backButton',
			expect.any(Function),
		);
	});

	it('skips native listener setup on web', async () => {
		capacitorMocks.isNativePlatform.mockReturnValue(false);
		const { initAndroidBackButton } = await import('../src/androidBack');
		await initAndroidBackButton();

		expect(appMocks.addListener).not.toHaveBeenCalled();
	});
});
