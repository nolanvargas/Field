import { apiFetch, expectJsonField, expectOk } from './client';
import type { CustomFieldValues, WithCustomFields } from '../customFields';

export interface AppUser extends WithCustomFields {
	id: string;
	displayName: string;
	email: string;
	phone: string;
	role: string;
	permissions: string[];
}

export interface MobileActivation {
	id: string;
	code: string;
	expiresAt: string;
	userId: string;
	displayName: string;
}

export interface UserWriteBody {
	displayName?: string;
	email?: string;
	phone?: string;
	role?: string;
	permissions?: string[];
	customFields?: CustomFieldValues;
}

function mapAppUser(u: AppUser): AppUser {
	return {
		id: u.id,
		displayName: u.displayName,
		email: u.email ?? '',
		phone: u.phone ?? '',
		role: u.role ?? '',
		permissions: Array.isArray(u.permissions) ? u.permissions : [],
		customFields: u.customFields ?? {},
		customFieldDisplays: u.customFieldDisplays ?? {},
	};
}

async function fetchUsers(
	role: string | null,
	signal?: AbortSignal,
): Promise<AppUser[]> {
	const params = new URLSearchParams();
	if (role) params.set('role', role);
	const qs = params.toString();
	const res = await apiFetch(`/api/users${qs ? `?${qs}` : ''}`, { signal });
	const data = await expectOk<{ users?: AppUser[] }>(res, 'Users list failed');
	return (data.users ?? []).map(mapAppUser);
}

export function listUsers(signal?: AbortSignal): Promise<AppUser[]> {
	return fetchUsers(null, signal);
}

export async function createUser(
	body: UserWriteBody & { displayName: string },
	opts?: { actorUserId?: string; signal?: AbortSignal },
): Promise<AppUser> {
	const payload: UserWriteBody & { actorUserId?: string } = { ...body };
	if (opts?.actorUserId) {
		payload.actorUserId = opts.actorUserId;
	}
	const res = await apiFetch('/api/users', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal: opts?.signal,
	});
	return mapAppUser(await expectJsonField(res, 'user', 'Create user failed'));
}

export async function updateUser(
	userId: string,
	body: UserWriteBody,
	opts?: { actorUserId?: string; signal?: AbortSignal },
): Promise<AppUser> {
	const payload: UserWriteBody & { actorUserId?: string } = { ...body };
	if (opts?.actorUserId) {
		payload.actorUserId = opts.actorUserId;
	}
	const res = await apiFetch(`/api/users/${userId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal: opts?.signal,
	});
	return mapAppUser(await expectJsonField(res, 'user', 'Update user failed'));
}

export async function deleteUser(
	userId: string,
	opts?: { actorUserId?: string; signal?: AbortSignal },
): Promise<void> {
	const body: { actorUserId?: string } = {};
	if (opts?.actorUserId) {
		body.actorUserId = opts.actorUserId;
	}
	const res = await apiFetch(`/api/users/${userId}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: opts?.signal,
	});
	await expectOk(res, 'Delete user failed');
}

/** Upsert the signed-in web SSO user and return the app user row. */
export async function syncSession(signal?: AbortSignal): Promise<AppUser> {
	const res = await apiFetch('/api/auth/session', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{}',
		signal,
	});
	return mapAppUser(await expectJsonField(res, 'user', 'Session sync failed'));
}

/** Issue a single-use mobile activation QR payload for a user. */
export async function issueMobileActivation(
	userId: string,
	opts?: { createdByUserId?: string; signal?: AbortSignal },
): Promise<MobileActivation> {
	const body: { createdByUserId?: string } = {};
	if (opts?.createdByUserId) {
		body.createdByUserId = opts.createdByUserId;
	}
	const res = await apiFetch(`/api/users/${userId}/mobile-activations`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: opts?.signal,
	});
	return expectOk(res, 'Issue activation failed');
}

export interface MobileDevice {
	id: string;
	userId: string;
	deviceLabel: string | null;
	activatedAt: string;
	lastSeenAt: string | null;
	revokedAt: string | null;
}

/** List mobile device sessions for a user. */
export async function listMobileDevices(
	userId: string,
	opts?: {
		actorUserId?: string;
		includeRevoked?: boolean;
		signal?: AbortSignal;
	},
): Promise<MobileDevice[]> {
	const params = new URLSearchParams();
	if (opts?.actorUserId) params.set('actorUserId', opts.actorUserId);
	if (opts?.includeRevoked) params.set('includeRevoked', '1');
	const qs = params.toString();
	const res = await apiFetch(
		`/api/users/${userId}/mobile-devices${qs ? `?${qs}` : ''}`,
		{ signal: opts?.signal },
	);
	const data = await expectOk<{ devices?: MobileDevice[] }>(
		res,
		'List mobile devices failed',
	);
	return data.devices ?? [];
}

/** Revoke one mobile device session. */
export async function revokeMobileDevice(
	userId: string,
	deviceId: string,
	opts?: { revokedByUserId?: string; signal?: AbortSignal },
): Promise<MobileDevice> {
	const body: { revokedByUserId?: string } = {};
	if (opts?.revokedByUserId) {
		body.revokedByUserId = opts.revokedByUserId;
	}
	const res = await apiFetch(
		`/api/users/${userId}/mobile-devices/${deviceId}`,
		{
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: opts?.signal,
		},
	);
	return expectJsonField(res, 'device', 'Revoke device failed');
}

/** Revoke all active mobile device sessions for a user. */
export async function revokeAllMobileDevices(
	userId: string,
	opts?: { revokedByUserId?: string; signal?: AbortSignal },
): Promise<{ revokedCount: number }> {
	const body: { revokedByUserId?: string } = {};
	if (opts?.revokedByUserId) {
		body.revokedByUserId = opts.revokedByUserId;
	}
	const res = await apiFetch(`/api/users/${userId}/mobile-devices`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: opts?.signal,
	});
	return expectOk(res, 'Revoke all devices failed');
}
