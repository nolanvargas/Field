import { apiFetch, expectOk } from './client';

export interface ActivateMobileResult {
	deviceSessionToken: string;
	userId: string;
	displayName: string;
	role: string;
	permissions: string[];
	deviceId: string;
	activatedAt: string;
}

export async function activateMobile(
	code: string,
	opts?: { deviceLabel?: string; signal?: AbortSignal },
): Promise<ActivateMobileResult> {
	const res = await apiFetch('/api/mobile/activate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			code,
			deviceLabel: opts?.deviceLabel,
		}),
		signal: opts?.signal ?? AbortSignal.timeout(30_000),
	});
	return expectOk(res, 'Activation failed');
}

export async function registerMobilePushToken(
	token: string,
	opts?: { signal?: AbortSignal },
): Promise<void> {
	const res = await apiFetch('/api/mobile/push-token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ token }),
		signal: opts?.signal ?? AbortSignal.timeout(15_000),
	});
	if (!res.ok) {
		await expectOk(res, 'Failed to register push token');
	}
}
