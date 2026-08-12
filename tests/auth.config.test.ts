import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEntraConfigured } from '../src/auth/config';

describe('isEntraConfigured', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('is false when Vite Azure env is unset', () => {
		vi.stubEnv('VITE_AZURE_CLIENT_ID', '');
		vi.stubEnv('VITE_AZURE_TENANT_ID', '');
		expect(isEntraConfigured()).toBe(false);
	});

	it('is true only when client id and tenant id are both set', () => {
		vi.stubEnv('VITE_AZURE_CLIENT_ID', 'client');
		vi.stubEnv('VITE_AZURE_TENANT_ID', 'tenant');
		expect(isEntraConfigured()).toBe(true);

		vi.stubEnv('VITE_AZURE_CLIENT_ID', 'client');
		vi.stubEnv('VITE_AZURE_TENANT_ID', '');
		expect(isEntraConfigured()).toBe(false);
	});
});
