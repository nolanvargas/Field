import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: () => false,
	},
}));

describe('captureRequiredGeo', () => {
	const getCurrentPosition = vi.fn();

	beforeEach(() => {
		getCurrentPosition.mockReset();
		Object.defineProperty(global.navigator, 'geolocation', {
			value: { getCurrentPosition },
			configurable: true,
		});
	});

	it('maps permission denied to a friendly message', async () => {
		getCurrentPosition.mockImplementation((_ok, reject) => {
			reject({ code: 1 });
		});

		const { captureRequiredGeo } = await import('../src/captureGeo');
		await expect(captureRequiredGeo()).rejects.toThrow(/Location permission is required/);
	});

	it('maps position unavailable to a GPS message', async () => {
		getCurrentPosition.mockImplementation((_ok, reject) => {
			reject({ code: 2 });
		});

		const { captureRequiredGeo } = await import('../src/captureGeo');
		await expect(captureRequiredGeo()).rejects.toThrow(/Location unavailable/);
	});

	it('maps timeout to a retry message', async () => {
		getCurrentPosition.mockImplementation((_ok, reject) => {
			reject({ code: 3 });
		});

		const { captureRequiredGeo } = await import('../src/captureGeo');
		await expect(captureRequiredGeo()).rejects.toThrow(/Timed out getting GPS/);
	});

	it('returns coordinates when geolocation succeeds', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T12:00:00Z'));

		getCurrentPosition.mockImplementation((resolve) => {
			resolve({
				coords: { latitude: 36.1, longitude: -115.2, accuracy: 12 },
			});
		});

		const { captureRequiredGeo } = await import('../src/captureGeo');
		await expect(captureRequiredGeo()).resolves.toEqual({
			latitude: 36.1,
			longitude: -115.2,
			accuracyMeters: 12,
			recordedAt: '2026-08-12T12:00:00.000Z',
		});

		vi.useRealTimers();
	});
});
