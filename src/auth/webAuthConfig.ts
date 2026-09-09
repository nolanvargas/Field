import { apiUrl } from '../api/client';
import { applyOrgAccent } from '../applyOrgAccent';
import { DEFAULT_ACCENT, normalizeAccentHex } from '../../shared/orgAccent.js';
import {
	WEB_AUTH_PROVIDER_ENTRA,
	WEB_AUTH_PROVIDER_STUB,
	type WebAuthProviderId,
} from '../../shared/webAuthProviders.js';
import type { EntraWebAuthConfig } from '../../shared/webAuthConfig.js';

export interface WebAuthPublicConfig {
	provider: WebAuthProviderId;
	config: EntraWebAuthConfig | null;
	accentColor?: string;
}

let loaded: WebAuthPublicConfig | null = null;
let loadPromise: Promise<WebAuthPublicConfig> | null = null;

function viteEntraFallback(): WebAuthPublicConfig | null {
	const clientId = (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined)?.trim();
	const tenantId = (import.meta.env.VITE_AZURE_TENANT_ID as string | undefined)?.trim();
	if (!clientId || !tenantId) return null;
	return {
		provider: WEB_AUTH_PROVIDER_ENTRA,
		config: { clientId, tenantId },
		accentColor: DEFAULT_ACCENT,
	};
}

function normalizePublicConfig(body: unknown): WebAuthPublicConfig {
	if (!body || typeof body !== 'object') {
		return { provider: WEB_AUTH_PROVIDER_STUB, config: null, accentColor: DEFAULT_ACCENT };
	}
	const row = body as Record<string, unknown>;
	const accentColor = normalizeAccentHex(row.accentColor);
	const provider = String(row.provider ?? WEB_AUTH_PROVIDER_STUB).trim();
	if (provider === WEB_AUTH_PROVIDER_ENTRA && row.config && typeof row.config === 'object') {
		const config = row.config as Record<string, unknown>;
		const clientId = String(config.clientId ?? '').trim();
		const tenantId = String(config.tenantId ?? '').trim();
		if (clientId && tenantId) {
			return {
				provider: WEB_AUTH_PROVIDER_ENTRA,
				config: { clientId, tenantId },
				accentColor,
			};
		}
	}
	return { provider: WEB_AUTH_PROVIDER_STUB, config: null, accentColor };
}

/** Fetch and cache public web auth settings from the API. */
export async function loadWebAuthConfig(): Promise<WebAuthPublicConfig> {
	if (loaded) return loaded;
	if (!loadPromise) {
		loadPromise = (async () => {
			try {
				const res = await fetch(apiUrl('/api/auth/config'));
				if (!res.ok) {
					throw new Error(`auth config ${res.status}`);
				}
				const body = await res.json();
				loaded = normalizePublicConfig(body);
				applyOrgAccent(loaded.accentColor);
				return loaded;
			} catch (err) {
				const fallback = viteEntraFallback();
				if (fallback) {
					loaded = fallback;
					applyOrgAccent(loaded.accentColor);
					return fallback;
				}
				loaded = { provider: WEB_AUTH_PROVIDER_STUB, config: null, accentColor: DEFAULT_ACCENT };
				applyOrgAccent(DEFAULT_ACCENT);
				return loaded;
			} finally {
				loadPromise = null;
			}
		})();
	}
	return loadPromise;
}

export function getWebAuthConfig(): WebAuthPublicConfig | null {
	return loaded ?? viteEntraFallback();
}

export function getActiveWebAuthProvider(): WebAuthProviderId {
	return getWebAuthConfig()?.provider ?? WEB_AUTH_PROVIDER_STUB;
}

export function isWebAuthEnabled(): boolean {
	return getActiveWebAuthProvider() !== WEB_AUTH_PROVIDER_STUB;
}

export function getEntraClientConfig(): EntraWebAuthConfig | null {
	const config = getWebAuthConfig();
	if (config?.provider !== WEB_AUTH_PROVIDER_ENTRA || !config.config) {
		return null;
	}
	return config.config;
}

/** Clear cached config (e.g. after Management saves new IdP settings). */
export function resetWebAuthConfigCache(): void {
	loaded = null;
	loadPromise = null;
}
