import { beforeEach, describe, expect, it, vi } from 'vitest';

const capacitorMocks = vi.hoisted(() => ({
	isNativePlatform: vi.fn(() => true),
	getPlatform: vi.fn(() => 'android'),
}));

const preferencesMocks = vi.hoisted(() => ({
	get: vi.fn(),
	set: vi.fn(),
	remove: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: capacitorMocks.isNativePlatform,
		getPlatform: capacitorMocks.getPlatform,
	},
}));

vi.mock('@capacitor/preferences', () => ({
	Preferences: preferencesMocks,
}));

vi.mock('../src/api/client', () => ({
	setAccessTokenProvider: vi.fn(),
}));

const validSession = {
	deviceSessionToken: 'tok-abc',
	userId: '550e8400-e29b-41d4-a716-446655440000',
	displayName: 'Crew One',
	role: 'crew',
	permissions: ['view_crew_map'],
	apiBaseUrl: 'http://localhost:3000',
};

describe('mobileSession', () => {
	beforeEach(async () => {
		vi.resetModules();
		capacitorMocks.isNativePlatform.mockReturnValue(true);
		preferencesMocks.get.mockReset();
		preferencesMocks.set.mockReset();
		preferencesMocks.remove.mockReset();
		localStorage.clear();

		const { clearMobileSession } = await import('../src/auth/mobileSession');
		await clearMobileSession();
	});

	it('returns null on web without reading storage', async () => {
		capacitorMocks.isNativePlatform.mockReturnValue(false);
		const { loadMobileSession, getMobileSession } = await import(
			'../src/auth/mobileSession'
		);

		await loadMobileSession();
		expect(getMobileSession()).toBeNull();
		expect(preferencesMocks.get).not.toHaveBeenCalled();
	});

	it('loads a valid stored session on native', async () => {
		preferencesMocks.get.mockResolvedValue({
			value: JSON.stringify(validSession),
		});

		const { loadMobileSession, getMobileSession } = await import(
			'../src/auth/mobileSession'
		);
		const session = await loadMobileSession();

		expect(session).toEqual(validSession);
		expect(getMobileSession()).toEqual(validSession);
	});

	it('clears corrupt stored JSON and returns null', async () => {
		preferencesMocks.get.mockResolvedValue({ value: '{not-json' });

		const { loadMobileSession, getMobileSession } = await import(
			'../src/auth/mobileSession'
		);
		const session = await loadMobileSession();

		expect(session).toBeNull();
		expect(getMobileSession()).toBeNull();
		expect(preferencesMocks.remove).toHaveBeenCalled();
	});

	it('clears sessions missing required fields', async () => {
		preferencesMocks.get.mockResolvedValue({
			value: JSON.stringify({ userId: 'x', displayName: 'No token' }),
		});

		const { loadMobileSession } = await import('../src/auth/mobileSession');
		await expect(loadMobileSession()).resolves.toBeNull();
		expect(preferencesMocks.remove).toHaveBeenCalled();
	});

	it('persists saveMobileSession to Preferences on native', async () => {
		const { saveMobileSession, getMobileSession } = await import(
			'../src/auth/mobileSession'
		);
		await saveMobileSession(validSession);

		expect(preferencesMocks.set).toHaveBeenCalledWith({
			key: 'field.mobileDeviceSession',
			value: JSON.stringify(validSession),
		});
		expect(getMobileSession()).toEqual(validSession);
	});
});
