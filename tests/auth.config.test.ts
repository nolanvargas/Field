/**
 * Manual QA (not covered here):
 * 1. Entra browser login — real MSAL redirect, token acquisition, POST /api/auth/session (requires IdP + browser).
 * 2. Dev stub picker — LoginPage user list when provider is stub (UI + unauthenticated API).
 * 3. Management save → cache refresh — change Web sign-in under Management; confirm login path updates without hard refresh.
 * 4. Capacitor — AuthRoot still loads /api/auth/config for org accent; crew uses QR activation only.
 * 5. Offline dev — stop API, set VITE_AZURE_* in .env; confirm app still boots into Entra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	WEB_AUTH_PROVIDER_ENTRA,
	WEB_AUTH_PROVIDER_STUB,
} from '../shared/webAuthProviders.js';
import { DEFAULT_ACCENT } from '../shared/orgAccent.js';
import {
	getActiveWebAuthProvider,
	getEntraClientConfig,
	getWebAuthConfig,
	isWebAuthEnabled,
	loadWebAuthConfig,
	resetWebAuthConfigCache,
} from '../src/auth/webAuthConfig';

const STUB_CONFIG = {
	provider: WEB_AUTH_PROVIDER_STUB,
	config: null,
	accentColor: DEFAULT_ACCENT,
};

function clearViteEntraEnv(): void {
	vi.stubEnv('VITE_AZURE_CLIENT_ID', '');
	vi.stubEnv('VITE_AZURE_TENANT_ID', '');
}

function setViteEntraEnv(clientId: string, tenantId: string): void {
	vi.stubEnv('VITE_AZURE_CLIENT_ID', clientId);
	vi.stubEnv('VITE_AZURE_TENANT_ID', tenantId);
}

function mockFetchJson(
	body: unknown,
	options: { ok?: boolean; status?: number } = {},
): ReturnType<typeof vi.fn> {
	const { ok = true, status = 200 } = options;
	const fetchMock = vi.fn().mockResolvedValue({
		ok,
		status,
		json: async () => body,
	});
	globalThis.fetch = fetchMock;
	return fetchMock;
}

function mockFetchReject(error: Error): ReturnType<typeof vi.fn> {
	const fetchMock = vi.fn().mockRejectedValue(error);
	globalThis.fetch = fetchMock;
	return fetchMock;
}

function mockDeferredFetch(
	response: { ok?: boolean; status?: number; body: unknown },
): { fetchMock: ReturnType<typeof vi.fn>; resolve: () => void } {
	let resolve!: () => void;
	const responsePromise = new Promise<{
		ok: boolean;
		status: number;
		json: () => Promise<unknown>;
	}>((res) => {
		resolve = () =>
			res({
				ok: response.ok ?? true,
				status: response.status ?? 200,
				json: async () => response.body,
			});
	});
	const fetchMock = vi.fn().mockImplementation(() => responsePromise);
	globalThis.fetch = fetchMock;
	return { fetchMock, resolve };
}

describe('client web auth config', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		resetWebAuthConfigCache();
		clearViteEntraEnv();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.unstubAllEnvs();
		resetWebAuthConfigCache();
	});

	describe('API success paths', () => {
		it('loads complete Entra config from API', async () => {
			mockFetchJson({
				provider: 'entra',
				config: { clientId: 'api-client', tenantId: 'api-tenant' },
			});

			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'api-client', tenantId: 'api-tenant' },
				accentColor: DEFAULT_ACCENT,
			});
			expect(isWebAuthEnabled()).toBe(true);
			expect(getActiveWebAuthProvider()).toBe(WEB_AUTH_PROVIDER_ENTRA);
			expect(getEntraClientConfig()).toEqual({
				clientId: 'api-client',
				tenantId: 'api-tenant',
			});
		});

		it('is stub when no env and API returns stub', async () => {
			mockFetchJson({ provider: 'stub', config: null });

			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
			expect(isWebAuthEnabled()).toBe(false);
			expect(getEntraClientConfig()).toBeNull();
		});

		it('passes through org accentColor from the API', async () => {
			mockFetchJson({
				provider: 'stub',
				config: null,
				accentColor: '#1c7ed6',
			});
			const config = await loadWebAuthConfig();
			expect(config.accentColor).toBe('#1c7ed6');
		});

		it('fetches /api/auth/config', async () => {
			const fetchMock = mockFetchJson({ provider: 'stub', config: null });
			await loadWebAuthConfig();
			expect(fetchMock).toHaveBeenCalledWith('/api/auth/config');
		});
	});

	describe('normalizePublicConfig (via API response)', () => {
		it.each([
			['null', null],
			['undefined', undefined],
			['empty string', ''],
			['number', 42],
			['array', []],
		])('returns stub for non-object body: %s', async (_label, body) => {
			mockFetchJson(body);
			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
		});

		it.each([
			['null config', { provider: 'entra', config: null }],
			['empty config object', { provider: 'entra', config: {} }],
			['missing tenantId', { provider: 'entra', config: { clientId: 'c' } }],
			['missing clientId', { provider: 'entra', config: { tenantId: 't' } }],
			[
				'whitespace-only clientId',
				{ provider: 'entra', config: { clientId: '  ', tenantId: 't' } },
			],
			[
				'whitespace-only tenantId',
				{ provider: 'entra', config: { clientId: 'c', tenantId: '  ' } },
			],
			[
				'case-sensitive provider ENTRA',
				{ provider: 'ENTRA', config: { clientId: 'c', tenantId: 't' } },
			],
			[
				'unknown provider',
				{ provider: 'okta', config: { clientId: 'c', tenantId: 't' } },
			],
			['config not an object', { provider: 'entra', config: 'invalid' }],
		])('returns stub for incomplete or invalid entra: %s', async (_label, body) => {
			mockFetchJson(body);
			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
			expect(getEntraClientConfig()).toBeNull();
		});

		it('coerces numeric clientId and tenantId to strings', async () => {
			mockFetchJson({
				provider: 'entra',
				config: { clientId: 123, tenantId: 456 },
			});
			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: '123', tenantId: '456' },
				accentColor: DEFAULT_ACCENT,
			});
		});

		it('trims provider and config fields', async () => {
			mockFetchJson({
				provider: ' entra ',
				config: { clientId: ' client ', tenantId: ' tenant ' },
			});
			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'client', tenantId: 'tenant' },
				accentColor: DEFAULT_ACCENT,
			});
		});

		it('passes through oversized and special-character public config values', async () => {
			const longId = 'a'.repeat(500);
			const specialTenant = 'tenant-<script>alert(1)</script>';
			mockFetchJson({
				provider: 'entra',
				config: { clientId: longId, tenantId: specialTenant },
			});
			const config = await loadWebAuthConfig();
			expect(config.config).toEqual({
				clientId: longId,
				tenantId: specialTenant,
			});
		});
	});

	describe('failure and fallback paths', () => {
		it('uses vite env fallback when API is unavailable', async () => {
			setViteEntraEnv('client', 'tenant');
			mockFetchReject(new Error('offline'));

			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'client', tenantId: 'tenant' },
				accentColor: DEFAULT_ACCENT,
			});
			expect(isWebAuthEnabled()).toBe(true);
			expect(getActiveWebAuthProvider()).toBe(WEB_AUTH_PROVIDER_ENTRA);
		});

		it.each([401, 500])(
			'falls back to vite env when API returns HTTP %i',
			async (status) => {
				setViteEntraEnv('env-client', 'env-tenant');
				mockFetchJson({ provider: 'stub', config: null }, { ok: false, status });

				const config = await loadWebAuthConfig();
				expect(config).toEqual({
					provider: WEB_AUTH_PROVIDER_ENTRA,
					config: { clientId: 'env-client', tenantId: 'env-tenant' },
					accentColor: DEFAULT_ACCENT,
				});
			},
		);

		it.each([401, 500])(
			'returns stub when API returns HTTP %i and no vite env',
			async (status) => {
				mockFetchJson({ provider: 'entra', config: { clientId: 'c', tenantId: 't' } }, {
					ok: false,
					status,
				});

				const config = await loadWebAuthConfig();
				expect(config).toEqual(STUB_CONFIG);
				expect(isWebAuthEnabled()).toBe(false);
			},
		);

		it('returns stub when fetch rejects and no vite env', async () => {
			mockFetchReject(new Error('network down'));

			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
			expect(isWebAuthEnabled()).toBe(false);
		});

		it('falls back to vite env when res.json() throws', async () => {
			setViteEntraEnv('json-client', 'json-tenant');
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => {
					throw new Error('invalid json');
				},
			});

			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'json-client', tenantId: 'json-tenant' },
				accentColor: DEFAULT_ACCENT,
			});
		});

		it('returns stub when res.json() throws and no vite env', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => {
					throw new Error('invalid json');
				},
			});

			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
		});

		it('returns stub when only partial vite env is set and API fails', async () => {
			vi.stubEnv('VITE_AZURE_CLIENT_ID', 'only-client');
			vi.stubEnv('VITE_AZURE_TENANT_ID', '');
			mockFetchReject(new Error('offline'));

			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
		});

		it('returns stub when vite env is whitespace-only and API fails', async () => {
			setViteEntraEnv('   ', '\t');
			mockFetchReject(new Error('offline'));

			const config = await loadWebAuthConfig();
			expect(config).toEqual(STUB_CONFIG);
		});
	});

	describe('caching and concurrency', () => {
		it('returns cached config without refetching', async () => {
			const fetchMock = mockFetchJson({ provider: 'stub', config: null });
			const first = await loadWebAuthConfig();

			fetchMock.mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({
					provider: 'entra',
					config: { clientId: 'new', tenantId: 'new' },
				}),
			});

			const second = await loadWebAuthConfig();
			expect(second).toEqual(first);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it('deduplicates concurrent loadWebAuthConfig calls', async () => {
			const { fetchMock, resolve } = mockDeferredFetch({
				body: { provider: 'entra', config: { clientId: 'c', tenantId: 't' } },
			});

			const first = loadWebAuthConfig();
			const second = loadWebAuthConfig();
			expect(fetchMock).toHaveBeenCalledTimes(1);

			resolve();
			const [configA, configB] = await Promise.all([first, second]);
			expect(configA).toEqual(configB);
			expect(configA).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'c', tenantId: 't' },
				accentColor: DEFAULT_ACCENT,
			});
		});

		it('reloads after resetWebAuthConfigCache', async () => {
			mockFetchJson({ provider: 'stub', config: null });
			await loadWebAuthConfig();
			expect(getActiveWebAuthProvider()).toBe(WEB_AUTH_PROVIDER_STUB);

			resetWebAuthConfigCache();
			mockFetchJson({
				provider: 'entra',
				config: { clientId: 'after-reset', tenantId: 'tenant' },
			});

			const config = await loadWebAuthConfig();
			expect(config).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'after-reset', tenantId: 'tenant' },
				accentColor: DEFAULT_ACCENT,
			});
		});
	});

	describe('sync getters before loadWebAuthConfig', () => {
		it('returns vite Entra fallback from getWebAuthConfig when env is set', () => {
			setViteEntraEnv('sync-client', 'sync-tenant');

			expect(getWebAuthConfig()).toEqual({
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId: 'sync-client', tenantId: 'sync-tenant' },
				accentColor: DEFAULT_ACCENT,
			});
			expect(getActiveWebAuthProvider()).toBe(WEB_AUTH_PROVIDER_ENTRA);
			expect(isWebAuthEnabled()).toBe(true);
			expect(getEntraClientConfig()).toEqual({
				clientId: 'sync-client',
				tenantId: 'sync-tenant',
			});
		});

		it('returns null from getWebAuthConfig when env is empty and not loaded', () => {
			expect(getWebAuthConfig()).toBeNull();
			expect(getActiveWebAuthProvider()).toBe(WEB_AUTH_PROVIDER_STUB);
			expect(isWebAuthEnabled()).toBe(false);
			expect(getEntraClientConfig()).toBeNull();
		});
	});
});
