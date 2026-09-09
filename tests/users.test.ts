import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PERMISSIONS } from '../shared/permissions.js';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
	connect: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({
		query: dbMocks.query,
		connect: dbMocks.connect,
	}),
}));

describe('deactivateUser', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
		dbMocks.connect.mockReset();
	});

	it('rejects deactivating yourself', async () => {
		const { deactivateUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.manageUsers] }],
		});

		await expect(deactivateUser('user-1', 'user-1')).rejects.toMatchObject({
			message: 'Cannot deactivate your own account',
			status: 403,
		});
	});
});

describe('createUser', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('requires displayName', async () => {
		const { createUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.manageUsers] }],
		});

		await expect(createUser({}, 'admin-1')).rejects.toMatchObject({
			message: 'displayName is required',
			status: 400,
		});
	});
});
