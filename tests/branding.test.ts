import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('branding', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('clientCompanyName is empty when env is unset', async () => {
		vi.stubEnv('VITE_COMPANY_NAME', '');
		const { clientCompanyName } = await import('../src/branding');
		expect(clientCompanyName()).toBe('');
	});

	it('clientCompanyName uses trimmed VITE_COMPANY_NAME when set', async () => {
		vi.stubEnv('VITE_COMPANY_NAME', '  Alpha Industries  ');
		const { clientCompanyName } = await import('../src/branding');
		expect(clientCompanyName()).toBe('Alpha Industries');
	});

	it('clientSupportEmail is empty when env is unset', async () => {
		vi.stubEnv('VITE_COMPANY_SUPPORT_EMAIL', '');
		const { clientSupportEmail } = await import('../src/branding');
		expect(clientSupportEmail()).toBe('');
	});

	it('clientSupportEmail uses trimmed VITE_COMPANY_SUPPORT_EMAIL when set', async () => {
		vi.stubEnv('VITE_COMPANY_SUPPORT_EMAIL', ' help@field.test ');
		const { clientSupportEmail } = await import('../src/branding');
		expect(clientSupportEmail()).toBe('help@field.test');
	});
});
