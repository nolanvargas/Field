import { describe, expect, it } from 'vitest';
import {
	envEntraWebAuthFallback,
	resolveWebAuthFromParts,
	webAuthProviderForDb,
	webAuthSourceFromDb,
} from '../shared/webAuthConfig.js';
import {
	WEB_AUTH_PROVIDER_ENTRA,
	WEB_AUTH_PROVIDER_STUB,
} from '../shared/webAuthProviders.js';

describe('webAuthConfig', () => {
	it('resolveWebAuthFromParts requires complete entra config', () => {
		expect(
			resolveWebAuthFromParts(WEB_AUTH_PROVIDER_ENTRA, {
				clientId: 'c',
				tenantId: 't',
			}),
		).toEqual({
			provider: WEB_AUTH_PROVIDER_ENTRA,
			config: { clientId: 'c', tenantId: 't' },
		});
		expect(
			resolveWebAuthFromParts(WEB_AUTH_PROVIDER_ENTRA, { clientId: 'c' }),
		).toEqual({ provider: WEB_AUTH_PROVIDER_STUB, config: null });
	});

	it('envEntraWebAuthFallback reads AZURE_* env vars', () => {
		expect(
			envEntraWebAuthFallback({
				AZURE_CLIENT_ID: 'client',
				AZURE_TENANT_ID: 'tenant',
			}),
		).toEqual({
			provider: WEB_AUTH_PROVIDER_ENTRA,
			config: { clientId: 'client', tenantId: 'tenant' },
		});
		expect(envEntraWebAuthFallback({})).toEqual({
			provider: WEB_AUTH_PROVIDER_STUB,
			config: null,
		});
	});

	it('maps db provider to management source', () => {
		expect(webAuthSourceFromDb(null)).toBe('env');
		expect(webAuthSourceFromDb('stub')).toBe(WEB_AUTH_PROVIDER_STUB);
		expect(webAuthSourceFromDb('entra')).toBe(WEB_AUTH_PROVIDER_ENTRA);
		expect(webAuthProviderForDb('env')).toBeNull();
		expect(webAuthProviderForDb('stub')).toBe(WEB_AUTH_PROVIDER_STUB);
	});
});
