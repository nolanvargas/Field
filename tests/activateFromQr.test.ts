import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ACTIVATION_CODE_PATTERN,
	canScanActivationQr,
} from '../src/auth/activateFromQr';

const capacitorMocks = vi.hoisted(() => ({
	isNativePlatform: vi.fn(() => true),
	getPlatform: vi.fn(() => 'android'),
}));

const activateMobileMock = vi.hoisted(() => vi.fn());
const saveMobileSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@capacitor/core', () => ({
	Capacitor: {
		isNativePlatform: capacitorMocks.isNativePlatform,
		getPlatform: capacitorMocks.getPlatform,
	},
}));

vi.mock('../src/api/mobile', () => ({
	activateMobile: activateMobileMock,
}));

vi.mock('../src/api/client', () => ({
	apiUrl: (path: string) => `http://localhost:3000${path}`,
}));

vi.mock('../src/auth/mobileSession', () => ({
	saveMobileSession: saveMobileSessionMock,
}));

describe('ACTIVATION_CODE_PATTERN', () => {
	it('accepts field1. codes with URL-safe characters', () => {
		expect(ACTIVATION_CODE_PATTERN.test('field1.abc123')).toBe(true);
		expect(ACTIVATION_CODE_PATTERN.test('field1.A_b-c')).toBe(true);
	});

	it('rejects codes without the field1. prefix', () => {
		expect(ACTIVATION_CODE_PATTERN.test('field2.abc')).toBe(false);
		expect(ACTIVATION_CODE_PATTERN.test('not-a-code')).toBe(false);
	});
});

describe('canScanActivationQr', () => {
	beforeEach(() => {
		capacitorMocks.isNativePlatform.mockReturnValue(true);
		capacitorMocks.getPlatform.mockReturnValue('android');
	});

	it('is true only on native Android', () => {
		expect(canScanActivationQr()).toBe(true);

		capacitorMocks.getPlatform.mockReturnValue('ios');
		expect(canScanActivationQr()).toBe(false);

		capacitorMocks.isNativePlatform.mockReturnValue(false);
		capacitorMocks.getPlatform.mockReturnValue('android');
		expect(canScanActivationQr()).toBe(false);
	});
});

describe('activateWithCode', () => {
	beforeEach(() => {
		activateMobileMock.mockReset();
		saveMobileSessionMock.mockReset();
		capacitorMocks.getPlatform.mockReturnValue('android');
	});

	it('rejects empty and invalid codes before calling the API', async () => {
		const { activateWithCode } = await import('../src/auth/activateFromQr');

		await expect(activateWithCode('')).rejects.toThrow(/Enter an activation code/);
		await expect(activateWithCode('bad-code')).rejects.toThrow(
			/Not a Field activation code/,
		);
		expect(activateMobileMock).not.toHaveBeenCalled();
	});

	it('activates, saves the session, and returns the display name', async () => {
		activateMobileMock.mockResolvedValue({
			deviceSessionToken: 'tok-1',
			userId: '550e8400-e29b-41d4-a716-446655440000',
			displayName: 'Crew Two',
			role: 'crew',
			permissions: [],
		});

		const { activateWithCode } = await import('../src/auth/activateFromQr');
		const result = await activateWithCode('  field1.test-code  ');

		expect(activateMobileMock).toHaveBeenCalledWith('field1.test-code', {
			deviceLabel: 'android device',
		});
		expect(saveMobileSessionMock).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceSessionToken: 'tok-1',
				displayName: 'Crew Two',
				apiBaseUrl: 'http://localhost:3000',
			}),
		);
		expect(result).toEqual({ displayName: 'Crew Two' });
	});
});
