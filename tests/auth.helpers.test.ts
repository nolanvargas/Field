import { describe, expect, it, afterEach } from 'vitest';
import {
	isAuthExemptPath,
	isEntraAuthEnabled,
	resolveTaskActor,
} from '../server/auth.mjs';

describe('server auth helpers', () => {
	const prevTenant = process.env.AZURE_TENANT_ID;
	const prevClient = process.env.AZURE_CLIENT_ID;

	afterEach(() => {
		if (prevTenant === undefined) delete process.env.AZURE_TENANT_ID;
		else process.env.AZURE_TENANT_ID = prevTenant;
		if (prevClient === undefined) delete process.env.AZURE_CLIENT_ID;
		else process.env.AZURE_CLIENT_ID = prevClient;
	});

	it('isAuthExemptPath allows health and mobile activate only', () => {
		expect(isAuthExemptPath('/api/health')).toBe(true);
		expect(isAuthExemptPath('/api/mobile/activate')).toBe(true);
		expect(isAuthExemptPath('/api/mobile/tasks')).toBe(false);
		expect(isAuthExemptPath('/api/tasks')).toBe(false);
	});

	it('isEntraAuthEnabled requires tenant and client', () => {
		delete process.env.AZURE_TENANT_ID;
		delete process.env.AZURE_CLIENT_ID;
		expect(isEntraAuthEnabled()).toBe(false);

		process.env.AZURE_TENANT_ID = 'tenant';
		process.env.AZURE_CLIENT_ID = 'client';
		expect(isEntraAuthEnabled()).toBe(true);
	});

	it('resolveTaskActor treats device sessions as authoritative and ignores others', () => {
		expect(
			resolveTaskActor({ auth: { deviceSession: { userId: 'u-1' } } }),
		).toEqual({ userId: 'u-1', kind: 'device' });
		// Entra JWT (claims, no deviceSession) keeps the caller-declared path.
		expect(resolveTaskActor({ auth: { userId: 'u-2', claims: {} } })).toBeNull();
		// No auth (dev mode) keeps the caller-declared path.
		expect(resolveTaskActor({})).toBeNull();
		// Explicitly null deviceSession keeps the caller-declared path.
		expect(resolveTaskActor({ auth: { deviceSession: null } })).toBeNull();
		// Blank session userId is rejected rather than trusted.
		expect(
			resolveTaskActor({ auth: { deviceSession: { userId: '   ' } } }),
		).toBeNull();
	});
});
