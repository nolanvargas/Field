import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	ALL_PERMISSIONS,
	PERMISSIONS,
	hasPermission,
	normalizePermissions,
	permissionsFromDb,
	wouldRemoveOwnManageUsers,
} from '../shared/permissions.js';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

describe('hasPermission', () => {
	it('is true when the key is present', () => {
		expect(
			hasPermission([PERMISSIONS.manageUsers], PERMISSIONS.manageUsers),
		).toBe(true);
	});

	it('is false for missing key, non-arrays, and empty', () => {
		expect(hasPermission([], PERMISSIONS.manageUsers)).toBe(false);
		expect(hasPermission(undefined, PERMISSIONS.manageUsers)).toBe(false);
		expect(hasPermission(null, PERMISSIONS.manageOrg)).toBe(false);
	});
});

describe('permissionsFromDb', () => {
	it('drops unknown keys and non-strings', () => {
		expect(
			permissionsFromDb([
				PERMISSIONS.manageOrg,
				'not-a-key',
				123,
				PERMISSIONS.viewCrewMap,
			]),
		).toEqual([PERMISSIONS.manageOrg, PERMISSIONS.viewCrewMap]);
	});

	it('returns [] for non-arrays', () => {
		expect(permissionsFromDb(null)).toEqual([]);
		expect(permissionsFromDb('manage_users')).toEqual([]);
	});
});

describe('normalizePermissions', () => {
	it('dedupes known keys', () => {
		expect(
			normalizePermissions([
				PERMISSIONS.manageUsers,
				PERMISSIONS.manageUsers,
				PERMISSIONS.manageOrg,
			]),
		).toEqual([PERMISSIONS.manageUsers, PERMISSIONS.manageOrg]);
	});

	it('throws 400 for unknown keys', () => {
		expect(() => normalizePermissions(['admin'])).toThrowError(
			expect.objectContaining({
				message: 'Unknown permission: admin',
				status: 400,
			}),
		);
	});

	it('throws 400 when not an array', () => {
		expect(() => normalizePermissions('manage_users')).toThrowError(
			expect.objectContaining({ status: 400 }),
		);
	});
});

describe('wouldRemoveOwnManageUsers', () => {
	const actor = 'user-1';

	it('is true when editing self without manage_users', () => {
		expect(
			wouldRemoveOwnManageUsers(actor, actor, [PERMISSIONS.manageOrg]),
		).toBe(true);
		expect(wouldRemoveOwnManageUsers(actor, actor, [])).toBe(true);
	});

	it('is false when self still has manage_users', () => {
		expect(
			wouldRemoveOwnManageUsers(actor, actor, [...ALL_PERMISSIONS]),
		).toBe(false);
	});

	it('is false when editing someone else', () => {
		expect(
			wouldRemoveOwnManageUsers(actor, 'user-2', []),
		).toBe(false);
	});
});

describe('updateUser self-lockout', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('rejects stripping manage_users from yourself before writing', async () => {
		const { updateUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [...ALL_PERMISSIONS] }],
		});

		await expect(
			updateUser(
				'user-1',
				{ permissions: [PERMISSIONS.manageOrg] },
				'user-1',
			),
		).rejects.toMatchObject({
			message: 'Cannot remove manage_users from yourself',
			status: 403,
		});

		expect(dbMocks.query).toHaveBeenCalledTimes(1);
	});
});
