import { Capacitor } from '@capacitor/core';
import { isDemoMode } from '../demo/isDemoMode';
import { demoRouter } from '../demo/router';

function isLoopbackHost(hostname: string): boolean {
	return (
		hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
	);
}

/** True when the page was loaded from the Vite dev server (live reload / LAN dev). */
function isViteDevServerPage(): boolean {
	if (typeof window === 'undefined') return false;
	const port = window.location.port;
	const vitePort = (import.meta.env.VITE_PORT as string | undefined) ?? '5173';
	return port === vitePort;
}

/**
 * Resolve an API path for the current client.
 * - DEV from Vite (:5173, including Capacitor live reload): relative `/api/...`
 *   (same origin — Vite proxies to :3000; avoids a second host:port on WebView
 *   and Windows firewall gaps on physical devices)
 * - Web on localhost (DEV) without Vite port: relative `/api/...`
 * - Bundled native Android: host loopback via 10.0.2.2
 * - Bundled native iOS simulator: Mac localhost
 * Override with VITE_API_BASE (e.g. http://192.168.1.10:3000 for a physical
 * device against local API).
 */
export function apiUrl(path: string): string {
	const p = path.startsWith('/') ? path : `/${path}`;
	const override = import.meta.env.VITE_API_BASE as string | undefined;
	if (override) {
		return `${override.replace(/\/$/, '')}${p}`;
	}

	if (import.meta.env.DEV) {
		if (isViteDevServerPage()) {
			return p;
		}
		const host =
			typeof window !== 'undefined' ? window.location.hostname : 'localhost';
		const useViteProxy = !Capacitor.isNativePlatform() && isLoopbackHost(host);
		if (useViteProxy) {
			return p;
		}
		return `http://${host}:3000${p}`;
	}

	if (Capacitor.isNativePlatform()) {
		if (Capacitor.getPlatform() === 'android') {
			return `http://10.0.2.2:3000${p}`;
		}
		return `http://127.0.0.1:3000${p}`;
	}

	return p;
}

type AccessTokenProvider = () => Promise<string | null>;

let accessTokenProvider: AccessTokenProvider | null = null;

/** Register a Bearer token provider (Entra MSAL on web / device session on mobile). Pass null to clear. */
export function setAccessTokenProvider(provider: AccessTokenProvider | null) {
	accessTokenProvider = provider;
}

export async function apiFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	if (isDemoMode()) {
		return demoRouter(path, init);
	}

	const url = apiUrl(path);
	const headers = new Headers(init?.headers);

	if (accessTokenProvider && !headers.has('Authorization')) {
		const token = await accessTokenProvider();
		if (token) headers.set('Authorization', `Bearer ${token}`);
	}

	let res: Response;
	try {
		res = await fetch(url, { cache: 'no-store', ...init, headers });
	} catch (err: unknown) {
		// React effect cleanup aborts in-flight requests — leave those alone.
		if (
			(err instanceof DOMException || err instanceof Error) &&
			err.name === 'AbortError'
		) {
			if (Capacitor.isNativePlatform() && path.includes('/api/mobile/activate')) {
				throw new Error(
					'Activation timed out — cannot reach the Field API. Run npm run dev on your PC, then npm run cap:live and Run from Android Studio.',
				);
			}
			throw err;
		}
		const reason = err instanceof Error ? err.message : String(err);
		if (
			Capacitor.isNativePlatform() &&
			/failed to fetch|network|connection|timed out/i.test(reason)
		) {
			throw new Error(
				'Cannot reach the Field API. Run npm run dev on your PC, then npm run cap:live and Run from Android Studio.',
			);
		}
		throw new Error(`${reason} (${url})`);
	}

	if (
		res.status === 401 &&
		Capacitor.isNativePlatform() &&
		!path.includes('/api/mobile/activate')
	) {
		// Dynamic import avoids a circular dependency with mobileSession.
		const { clearMobileSession, getMobileSession } = await import(
			'../auth/mobileSession'
		);
		if (getMobileSession()) {
			await clearMobileSession();
		}
	}

	// Web Entra: one retry with a forced token refresh (stale ID token cache).
	if (
		res.status === 401 &&
		!Capacitor.isNativePlatform() &&
		accessTokenProvider &&
		!headers.has('X-Field-Auth-Retry')
	) {
		try {
			const { getMsalInstance } = await import('../auth/msalConfig');
			const { acquireIdToken } = await import('../auth/token');
			const instance = getMsalInstance();
			const account =
				instance.getActiveAccount() ?? instance.getAllAccounts()[0];
			if (account) {
				const fresh = await acquireIdToken(instance, account, {
					forceRefresh: true,
				});
				headers.set('Authorization', `Bearer ${fresh}`);
				headers.set('X-Field-Auth-Retry', '1');
				return await fetch(url, { cache: 'no-store', ...init, headers });
			}
		} catch (err) {
			console.error('[auth] 401 retry refresh failed', err);
		}
	}

	return res;
}

type ErrorBody = { error?: string };

/** Parse JSON body; empty object on failure. */
export async function readJson<T>(res: Response): Promise<T> {
	return (await res.json().catch(() => ({}))) as T;
}

/**
 * Throw when `!res.ok`, using `data.error` when present.
 * Returns the parsed JSON body on success.
 */
export async function expectOk<T extends object>(
	res: Response,
	fallback: string,
): Promise<T> {
	const data = await readJson<T & ErrorBody>(res);
	if (!res.ok) {
		throw new Error(data.error ?? `${fallback} (${res.status})`);
	}
	return data;
}

/** Like expectOk, then require a named field (throws if missing). */
export async function expectJsonField<T>(
	res: Response,
	field: string,
	fallback: string,
): Promise<T> {
	const data = await expectOk<Record<string, T | undefined> & ErrorBody>(
		res,
		fallback,
	);
	const value = data[field];
	if (value == null) {
		throw new Error(`${fallback}: empty response`);
	}
	return value;
}
