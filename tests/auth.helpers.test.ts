/**
 * Manual QA (not covered here):
 * 1. Live Entra JWT through requireWebAuth on a running API (MSAL + JWKS).
 * 2. QR activation → opaque device Bearer on protected crew routes.
 * 3. Exempt routes reachable without auth when SSO is on (/api/tracking/*, /api/auth/config).
 * 4. Management/org-config routes blocked on Capacitor device sessions (403 on device).
 * 5. Dev stub mode — requireWebAuth no-op when org + env resolve to stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../shared/permissions.js';
import * as mobileAuth from '../server/mobileAuth.mjs';
import * as verifiedIdentity from '../server/auth/verifiedIdentity.mjs';
import * as webAuth from '../server/auth/webAuth.mjs';
import {
	assertAuthenticatedPermission,
	assertOrgConfiguration,
	assertTaskActorForMutation,
	getBearerToken,
	isAuthExemptPath,
	isDeviceSession,
	isWebAuthEnabled,
	getWebAuthPublicConfig,
	requireWebAuth,
	resolveAuthenticatedUserId,
	resolveTaskActor,
	resolveTaskListFilters,
} from '../server/auth.mjs';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

function mockOrgSettingsEnvFallback() {
	dbMocks.query.mockResolvedValue({
		rows: [{ web_auth_provider: null, web_auth_config: null }],
	});
}

function mockOrgSettingsStub() {
	dbMocks.query.mockResolvedValue({
		rows: [{ web_auth_provider: 'stub', web_auth_config: null }],
	});
}

function mockOrgSettingsEntra(
	clientId = 'db-client',
	tenantId = 'db-tenant',
) {
	dbMocks.query.mockResolvedValue({
		rows: [
			{
				web_auth_provider: 'entra',
				web_auth_config: { clientId, tenantId },
			},
		],
	});
}

async function clearWebAuthCache() {
	const { invalidateWebAuthSettingsCache } = await import(
		'../server/auth/webAuthSettings.mjs'
	);
	invalidateWebAuthSettingsCache();
}

function authReq(authorization?: string) {
	return {
		headers: authorization === undefined ? {} : { authorization },
		auth: undefined as
			| {
					userId?: string;
					identity?: unknown;
					deviceSession?: { userId?: string } | null;
			  }
			| undefined,
	};
}

describe('server auth helpers', () => {
	const prevTenant = process.env.AZURE_TENANT_ID;
	const prevClient = process.env.AZURE_CLIENT_ID;

	beforeEach(() => {
		dbMocks.query.mockReset();
		mockOrgSettingsEnvFallback();
	});

	afterEach(() => {
		if (prevTenant === undefined) delete process.env.AZURE_TENANT_ID;
		else process.env.AZURE_TENANT_ID = prevTenant;
		if (prevClient === undefined) delete process.env.AZURE_CLIENT_ID;
		else process.env.AZURE_CLIENT_ID = prevClient;
		vi.restoreAllMocks();
		void clearWebAuthCache();
	});

	describe('isAuthExemptPath', () => {
		it('allows health, auth config, mobile activate, and public routes', () => {
			expect(isAuthExemptPath('/api/health')).toBe(true);
			expect(isAuthExemptPath('/api/auth/config')).toBe(true);
			expect(isAuthExemptPath('/api/mobile/activate')).toBe(true);
			expect(isAuthExemptPath('/api/tracking/tasks/abc')).toBe(true);
		});

		it('rejects non-exempt API paths and malformed variants', () => {
			expect(isAuthExemptPath('/api/mobile/tasks')).toBe(false);
			expect(isAuthExemptPath('/api/tasks')).toBe(false);
			expect(isAuthExemptPath('/api/public')).toBe(false);
			expect(isAuthExemptPath('/api/health/')).toBe(false);
			expect(isAuthExemptPath('/API/HEALTH')).toBe(false);
			expect(isAuthExemptPath('/api/mobile/activate/extra')).toBe(false);
			expect(isAuthExemptPath('')).toBe(false);
		});
	});

	describe('isWebAuthEnabled / getWebAuthPublicConfig', () => {
		it('requires complete tenant and client from env when DB uses env fallback', async () => {
			delete process.env.AZURE_TENANT_ID;
			delete process.env.AZURE_CLIENT_ID;
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(false);
			expect(await getWebAuthPublicConfig()).toEqual({
				provider: 'stub',
				config: null,
			});

			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(true);
			expect(await getWebAuthPublicConfig()).toEqual({
				provider: 'entra',
				config: { clientId: 'client', tenantId: 'tenant' },
			});
		});

		it('treats partial or whitespace env as stub', async () => {
			process.env.AZURE_TENANT_ID = 'tenant';
			delete process.env.AZURE_CLIENT_ID;
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(false);

			process.env.AZURE_CLIENT_ID = '   ';
			process.env.AZURE_TENANT_ID = 'tenant';
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(false);

			process.env.AZURE_CLIENT_ID = 'client';
			process.env.AZURE_TENANT_ID = '  tenant  ';
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(true);
			expect(await getWebAuthPublicConfig()).toEqual({
				provider: 'entra',
				config: { clientId: 'client', tenantId: 'tenant' },
			});
		});

		it('prefers DB entra config over env fallback', async () => {
			delete process.env.AZURE_TENANT_ID;
			delete process.env.AZURE_CLIENT_ID;
			mockOrgSettingsEntra('db-client', 'db-tenant');
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(true);
			expect(await getWebAuthPublicConfig()).toEqual({
				provider: 'entra',
				config: { clientId: 'db-client', tenantId: 'db-tenant' },
			});
		});

		it('forces stub when DB provider is stub despite env', async () => {
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			mockOrgSettingsStub();
			await clearWebAuthCache();
			expect(await isWebAuthEnabled()).toBe(false);
			expect(await getWebAuthPublicConfig()).toEqual({
				provider: 'stub',
				config: null,
			});
		});
	});

	describe('isDeviceSession', () => {
		it('is true only when deviceSession is present', () => {
			expect(
				isDeviceSession({ auth: { deviceSession: { userId: 'u-1' } } }),
			).toBe(true);
			expect(
				isDeviceSession({
					auth: { deviceSession: {} as { userId: string } },
				}),
			).toBe(true);
			expect(
				isDeviceSession({
					auth: { userId: 'u-2', identity: {} },
				} as Parameters<typeof isDeviceSession>[0]),
			).toBe(false);
			expect(isDeviceSession({ auth: null })).toBe(false);
			expect(isDeviceSession({ auth: { deviceSession: null } })).toBe(false);
			expect(isDeviceSession({})).toBe(false);
		});
	});

	describe('assertOrgConfiguration', () => {
		it('blocks mobile device sessions with 403', () => {
			expect(() =>
				assertOrgConfiguration({
					auth: { deviceSession: { userId: 'u-1' } },
				}),
			).toThrowError(
				expect.objectContaining({
					message: 'Org configuration is not available on mobile sessions',
					status: 403,
				}),
			);
			expect(() =>
				assertOrgConfiguration({ auth: { deviceSession: {} } }),
			).toThrowError(expect.objectContaining({ status: 403 }));
		});

		it('allows web and unauthenticated requests', () => {
			expect(() =>
				assertOrgConfiguration({
					auth: { userId: 'u-2', identity: {} },
				} as Parameters<typeof assertOrgConfiguration>[0]),
			).not.toThrow();
			expect(() => assertOrgConfiguration({})).not.toThrow();
		});
	});

	describe('resolveTaskListFilters', () => {
		it('honors query params', () => {
			const params = new URLSearchParams(
				'crewMemberId=abc&createdByUserId=def',
			);
			expect(resolveTaskListFilters(params)).toEqual({
				crewMemberId: 'abc',
				createdByUserId: 'def',
			});
		});

		it('returns nulls when filters omitted or blank', () => {
			expect(resolveTaskListFilters(new URLSearchParams())).toEqual({
				crewMemberId: null,
				createdByUserId: null,
			});
			expect(
				resolveTaskListFilters(
					new URLSearchParams('crewMemberId=   &createdByUserId=%20%20'),
				),
			).toEqual({
				crewMemberId: null,
				createdByUserId: null,
			});
		});

		it('trims values and ignores unrelated params', () => {
			expect(
				resolveTaskListFilters(
					new URLSearchParams(
						'crewMemberId=%20abc%20&createdByUserId=def&status=open',
					),
				),
			).toEqual({
				crewMemberId: 'abc',
				createdByUserId: 'def',
			});
		});

		it('uses first value when duplicate keys appear', () => {
			expect(
				resolveTaskListFilters(
					new URLSearchParams('crewMemberId=first&crewMemberId=second'),
				),
			).toEqual({
				crewMemberId: 'first',
				createdByUserId: null,
			});
		});
	});

	describe('resolveTaskActor', () => {
		it('treats device sessions as authoritative and ignores others', () => {
			expect(
				resolveTaskActor({ auth: { deviceSession: { userId: 'u-1' } } }),
			).toEqual({ userId: 'u-1', kind: 'device' });
			expect(
				resolveTaskActor({ auth: { deviceSession: { userId: '  u-1  ' } } }),
			).toEqual({ userId: 'u-1', kind: 'device' });
			expect(
				resolveTaskActor({
					auth: { userId: 'u-2', identity: {} },
				} as Parameters<typeof resolveTaskActor>[0]),
			).toBeNull();
			expect(resolveTaskActor({})).toBeNull();
			expect(resolveTaskActor({ auth: { deviceSession: null } })).toBeNull();
			expect(
				resolveTaskActor({ auth: { deviceSession: { userId: '   ' } } }),
			).toBeNull();
		});

		it('rejects non-string or empty device user ids', () => {
			expect(
				resolveTaskActor({
					auth: { deviceSession: { userId: null as unknown as string } },
				}),
			).toBeNull();
			expect(
				resolveTaskActor({
					auth: { deviceSession: {} as { userId: string } },
				}),
			).toBeNull();
		});
	});

	describe('getBearerToken', () => {
		it('returns null when authorization is missing or not a string', () => {
			expect(getBearerToken(authReq())).toBeNull();
			expect(
				getBearerToken({
					headers: { authorization: ['Bearer a', 'Bearer b'] as unknown as string },
				}),
			).toBeNull();
		});

		it('extracts Bearer tokens case-insensitively with trimming', () => {
			expect(getBearerToken(authReq('Bearer my-token'))).toBe('my-token');
			expect(getBearerToken(authReq('bearer my-token'))).toBe('my-token');
			expect(getBearerToken(authReq('  Bearer   spaced-token  '))).toBe(
				'spaced-token',
			);
		});

		it('returns null for malformed Bearer headers', () => {
			expect(getBearerToken(authReq('Bearer'))).toBeNull();
			expect(getBearerToken(authReq('Bearer   '))).toBeNull();
			expect(getBearerToken(authReq('Basic dXNlcjpwYXNz'))).toBeNull();
			expect(getBearerToken(authReq('Token my-token'))).toBeNull();
		});

		it('extracts very long opaque tokens without truncation', () => {
			const longToken = `x${'a'.repeat(10_000)}`;
			expect(getBearerToken(authReq(`Bearer ${longToken}`))).toBe(longToken);
		});
	});

	describe('requireWebAuth', () => {
		async function enableWebAuth() {
			process.env.AZURE_TENANT_ID = 'tenant';
			process.env.AZURE_CLIENT_ID = 'client';
			mockOrgSettingsEnvFallback();
			await clearWebAuthCache();
		}

		it('returns null when web auth is disabled', async () => {
			delete process.env.AZURE_TENANT_ID;
			delete process.env.AZURE_CLIENT_ID;
			mockOrgSettingsStub();
			await clearWebAuthCache();
			const req = authReq();
			expect(await requireWebAuth(req, '/api/tasks')).toBeNull();
			expect(req.auth).toBeUndefined();
		});

		it('returns null for exempt paths without a Bearer token', async () => {
			await enableWebAuth();
			const healthReq = authReq();
			expect(await requireWebAuth(healthReq, '/api/health')).toBeNull();
			const publicReq = authReq();
			expect(await requireWebAuth(publicReq, '/api/tracking/track/1')).toBeNull();
		});

		it('throws 401 on protected paths without Bearer', async () => {
			await enableWebAuth();
			await expect(requireWebAuth(authReq(), '/api/tasks')).rejects.toMatchObject({
				message: 'Unauthorized',
				status: 401,
			});
		});

		it('accepts opaque device session tokens', async () => {
			await enableWebAuth();
			const device = {
				userId: 'crew-1',
				deviceId: 'dev-1',
				displayName: 'Crew',
				role: '',
				permissions: [],
			};
			const verifySpy = vi
				.spyOn(mobileAuth, 'verifyDeviceSessionToken')
				.mockResolvedValue(device);
			const token = mobileAuth.mintDeviceSessionToken();
			const req = authReq(`Bearer ${token}`);

			const result = await requireWebAuth(req, '/api/mobile/tasks');
			expect(verifySpy).toHaveBeenCalledWith(token);
			expect(result).toEqual(device);
			expect(req.auth).toEqual({
				userId: 'crew-1',
				deviceSession: device,
			});
		});

		it('accepts JWT-shaped web tokens', async () => {
			await enableWebAuth();
			const identity = {
				subjectId: 'web-user-1',
				email: 'user@example.com',
				name: 'User',
			};
			const verifySpy = vi
				.spyOn(webAuth, 'verifyWebToken')
				.mockResolvedValue(identity);
			const req = authReq('Bearer header.payload.sig');

			const result = await requireWebAuth(req, '/api/tasks');
			expect(verifySpy).toHaveBeenCalledWith('header.payload.sig');
			expect(result).toEqual(identity);
			expect(req.auth).toEqual({
				userId: 'web-user-1',
				identity,
			});
		});

		it('propagates device verification failures', async () => {
			await enableWebAuth();
			vi.spyOn(mobileAuth, 'verifyDeviceSessionToken').mockRejectedValue(
				Object.assign(new Error('Unauthorized'), { status: 401 }),
			);
			const token = mobileAuth.mintDeviceSessionToken();
			await expect(
				requireWebAuth(authReq(`Bearer ${token}`), '/api/mobile/tasks'),
			).rejects.toMatchObject({ status: 401 });
		});

		it('wraps generic web token failures as 401', async () => {
			await enableWebAuth();
			vi.spyOn(webAuth, 'verifyWebToken').mockRejectedValue(
				new Error('Token expired'),
			);
			await expect(
				requireWebAuth(authReq('Bearer a.b.c'), '/api/tasks'),
			).rejects.toMatchObject({
				message: 'Token expired',
				status: 401,
			});
		});

		it('re-throws web token errors that already carry status', async () => {
			await enableWebAuth();
			const serviceError = Object.assign(
				new Error('Web auth is not configured'),
				{ status: 503 },
			);
			vi.spyOn(webAuth, 'verifyWebToken').mockRejectedValue(serviceError);
			await expect(
				requireWebAuth(authReq('Bearer a.b.c'), '/api/tasks'),
			).rejects.toBe(serviceError);
		});
	});

	describe('resolveAuthenticatedUserId', () => {
		it('upserts and returns id for verified web identity', async () => {
			const identity = {
				subjectId: 'idp-subject',
				email: 'user@example.com',
				name: 'User',
			};
			vi.spyOn(verifiedIdentity, 'upsertUserFromVerifiedIdentity').mockResolvedValue(
				{
					id: 'db-user-1',
					displayName: 'User',
					email: 'user@example.com',
					phone: null,
					role: '',
					permissions: [],
				},
			);
			await expect(
				resolveAuthenticatedUserId({ auth: { identity } }),
			).resolves.toBe('db-user-1');
		});

		it('returns trimmed device session user id', async () => {
			await expect(
				resolveAuthenticatedUserId({
					auth: { deviceSession: { userId: '  crew-1  ' } },
				}),
			).resolves.toBe('crew-1');
			await expect(
				resolveAuthenticatedUserId({
					auth: { deviceSession: { userId: '   ' } },
				}),
			).resolves.toBeNull();
		});

		it('falls back to trimmed auth.userId for dev paths', async () => {
			await expect(
				resolveAuthenticatedUserId({ auth: { userId: '  dev-user  ' } }),
			).resolves.toBe('dev-user');
			await expect(
				resolveAuthenticatedUserId({ auth: { userId: '   ' } }),
			).resolves.toBeNull();
		});

		it('returns null when auth is absent', async () => {
			await expect(resolveAuthenticatedUserId({})).resolves.toBeNull();
		});
	});

	describe('assertAuthenticatedPermission', () => {
		it('throws 401 when no actor can be resolved', async () => {
			await expect(
				assertAuthenticatedPermission({}, PERMISSIONS.manageUsers),
			).rejects.toMatchObject({
				message: 'Unauthorized',
				status: 401,
			});
		});

		it('throws 403 when actor lacks permission', async () => {
			dbMocks.query.mockResolvedValue({
				rows: [{ permissions: [] }],
			});
			await expect(
				assertAuthenticatedPermission(
					{ auth: { userId: 'user-1' } },
					PERMISSIONS.manageUsers,
				),
			).rejects.toMatchObject({
				message: 'Forbidden',
				status: 403,
			});
		});

		it('returns actor id when permission is present', async () => {
			dbMocks.query.mockResolvedValue({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			});
			await expect(
				assertAuthenticatedPermission(
					{ auth: { userId: 'user-1' } },
					PERMISSIONS.manageUsers,
				),
			).resolves.toBe('user-1');
		});
	});

	describe('assertTaskActorForMutation', () => {
		it('no-ops for web or unauthenticated requests', async () => {
			await expect(
				assertTaskActorForMutation(
					{ auth: { userId: 'user-1' } } as Parameters<
						typeof assertTaskActorForMutation
					>[0],
					42,
				),
			).resolves.toBeUndefined();
			await expect(assertTaskActorForMutation({}, 42)).resolves.toBeUndefined();
			expect(dbMocks.query).not.toHaveBeenCalled();
		});

		it('throws 403 when device actor is not assigned to the task', async () => {
			dbMocks.query.mockResolvedValue({ rowCount: 0 });
			await expect(
				assertTaskActorForMutation(
					{ auth: { deviceSession: { userId: 'crew-1' } } },
					42,
				),
			).rejects.toMatchObject({
				message: 'User is not assigned to this task',
				status: 403,
			});
		});

		it('allows device actor assigned to the task', async () => {
			dbMocks.query.mockResolvedValue({ rowCount: 1 });
			await expect(
				assertTaskActorForMutation(
					{ auth: { deviceSession: { userId: 'crew-1' } } },
					42,
				),
			).resolves.toBeUndefined();
			expect(dbMocks.query).toHaveBeenCalledWith(
				expect.stringContaining('task_crew_members'),
				[42, 'crew-1'],
			);
		});
	});
});
