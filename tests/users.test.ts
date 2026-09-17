/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PERMISSIONS } from '../shared/permissions.js';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
	connect: vi.fn(),
	clientQuery: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({
		query: dbMocks.query,
		connect: dbMocks.connect,
	}),
}));

vi.mock('../server/entityCustomFields.mjs', () => ({
	parseEntityCustomFields: vi.fn(async () => undefined),
	withEntityCustomFields: vi.fn(async (_pool, _entity, row) => row),
}));

const USER_ROW = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	display_name: 'Jane Crew',
	email: 'jane@example.com',
	phone: '555-0100',
	role: 'crew',
	permissions: [PERMISSIONS.viewCrewMap],
	custom_fields: {},
};

describe('mapUserRow', () => {
	it('maps snake_case DB columns to API shape', async () => {
		const { mapUserRow } = await import('../server/users.mjs');
		expect(mapUserRow(USER_ROW)).toEqual({
			id: USER_ROW.id,
			displayName: 'Jane Crew',
			email: 'jane@example.com',
			phone: '555-0100',
			role: 'crew',
			permissions: [PERMISSIONS.viewCrewMap],
		});
	});

	it('defaults null email, phone, and role to empty strings', async () => {
		const { mapUserRow } = await import('../server/users.mjs');
		expect(
			mapUserRow({
				...USER_ROW,
				email: null,
				phone: null,
				role: null,
				permissions: null,
			}),
		).toEqual({
			id: USER_ROW.id,
			displayName: 'Jane Crew',
			email: '',
			phone: '',
			role: '',
			permissions: [],
		});
	});
});

describe('deactivateUser', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
		dbMocks.connect.mockReset();
		dbMocks.clientQuery.mockReset();
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

	it('blocks deactivating the only manage_users holder', async () => {
		const { deactivateUser } = await import('../server/users.mjs');
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({ rows: [] });

		await expect(
			deactivateUser('last-admin', 'other-admin'),
		).rejects.toMatchObject({
			message: 'Cannot remove the only user with Manage users access',
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

	it('rejects invalid email before insert', async () => {
		const { createUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.manageUsers] }],
		});

		await expect(
			createUser({ displayName: 'Bad Email', email: 'not-an-email' }, 'admin-1'),
		).rejects.toMatchObject({
			message: 'email is invalid',
			status: 400,
		});
	});

	it('normalizes email to lowercase on create', async () => {
		const { createUser } = await import('../server/users.mjs');
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({ rows: [USER_ROW] });

		await createUser(
			{ displayName: 'Jane Crew', email: 'JANE@Example.COM' },
			'admin-1',
		);

		expect(dbMocks.query).toHaveBeenLastCalledWith(
			expect.stringContaining('INSERT INTO users'),
			expect.arrayContaining(['jane@example.com']),
		);
	});

	it('returns 403 when actor lacks manage_users', async () => {
		const { createUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.viewCrewMap] }],
		});

		await expect(
			createUser({ displayName: 'New User' }, 'crew-1'),
		).rejects.toMatchObject({
			message: 'Forbidden',
			status: 403,
		});
	});
});

describe('updateUser', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('requires userId', async () => {
		const { updateUser } = await import('../server/users.mjs');
		await expect(updateUser('', { displayName: 'X' }, 'admin-1')).rejects.toMatchObject({
			message: 'userId is required',
			status: 400,
		});
	});

	it('requires at least one field', async () => {
		const { updateUser } = await import('../server/users.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.manageUsers] }],
		});

		await expect(updateUser('user-1', {}, 'admin-1')).rejects.toMatchObject({
			message:
				'displayName, email, phone, role, permissions, or customFields is required',
			status: 400,
		});
	});

	it('normalizes email to lowercase on update', async () => {
		const { updateUser } = await import('../server/users.mjs');
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({ rows: [USER_ROW] });

		await updateUser('user-1', { email: ' NEW@Example.COM ' }, 'admin-1');

		expect(dbMocks.query).toHaveBeenLastCalledWith(
			expect.stringContaining('UPDATE users SET'),
			expect.arrayContaining(['new@example.com', 'user-1']),
		);
	});

	it('returns 404 when user is missing', async () => {
		const { updateUser } = await import('../server/users.mjs');
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({ rows: [] });

		await expect(
			updateUser('missing-user', { displayName: 'Ghost' }, 'admin-1'),
		).rejects.toMatchObject({
			message: 'User not found',
			status: 404,
		});
	});

	it('maps duplicate email constraint to 409', async () => {
		const { updateUser } = await import('../server/users.mjs');
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockRejectedValueOnce({ code: '23505' });

		await expect(
			updateUser('user-1', { email: 'taken@example.com' }, 'admin-1'),
		).rejects.toMatchObject({
			message: 'A user with that email already exists',
			status: 409,
		});
	});
});
