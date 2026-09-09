import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PERMISSIONS } from '../shared/permissions.js';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({ query: dbMocks.query }),
}));

describe('taskAccess', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('allows users with view_all_tasks to view any task', async () => {
		const { userCanViewAllTasks, isUserAllowedToViewTask } = await import(
			'../server/taskAccess.mjs'
		);
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.viewAllTasks] }],
		});

		expect(await userCanViewAllTasks('user-1')).toBe(true);
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.viewAllTasks] }],
		});
		expect(await isUserAllowedToViewTask('user-1', 42)).toBe(true);
	});

	it('allows assigned crew without view_all_tasks', async () => {
		const { isUserAllowedToViewTask } = await import(
			'../server/taskAccess.mjs'
		);
		dbMocks.query
			.mockResolvedValueOnce({ rows: [{ permissions: [] }] })
			.mockResolvedValueOnce({ rowCount: 1 });

		expect(await isUserAllowedToViewTask('user-1', 42)).toBe(true);
	});

	it('allows task creators without view_all_tasks', async () => {
		const { isUserAllowedToViewTask } = await import(
			'../server/taskAccess.mjs'
		);
		dbMocks.query
			.mockResolvedValueOnce({ rows: [{ permissions: [] }] })
			.mockResolvedValueOnce({ rowCount: 0 })
			.mockResolvedValueOnce({ rowCount: 1 });

		expect(await isUserAllowedToViewTask('user-1', 42)).toBe(true);
	});

	it('rejects unrelated users', async () => {
		const { assertUserCanViewTask } = await import(
			'../server/taskAccess.mjs'
		);
		dbMocks.query
			.mockResolvedValueOnce({ rows: [{ permissions: [] }] })
			.mockResolvedValueOnce({ rowCount: 0 })
			.mockResolvedValueOnce({ rowCount: 0 });

		await expect(assertUserCanViewTask('user-1', 42)).rejects.toMatchObject({
			status: 403,
		});
	});
});

describe('resolveScopedTaskListFilters', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('forces device sessions to their own assignments', async () => {
		const { resolveScopedTaskListFilters } = await import(
			'../server/auth.mjs'
		);
		const params = new URLSearchParams({
			crewMemberId: 'other-user',
			createdByUserId: 'other-user',
		});
		const req = {
			auth: { deviceSession: { userId: 'crew-1' } },
		};

		await expect(
			resolveScopedTaskListFilters(req, params),
		).resolves.toEqual({
			crewMemberId: 'crew-1',
			createdByUserId: null,
		});
	});

	it('scopes web users without view_all_tasks to themselves', async () => {
		const { resolveScopedTaskListFilters } = await import(
			'../server/auth.mjs'
		);
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [] }],
		});
		const params = new URLSearchParams({
			crewMemberId: 'other-user',
		});
		const req = {
			auth: { userId: 'user-1' },
		};

		await expect(
			resolveScopedTaskListFilters(req, params),
		).resolves.toEqual({
			crewMemberId: 'user-1',
			createdByUserId: 'user-1',
		});
	});

	it('honors query filters for users with view_all_tasks', async () => {
		const { resolveScopedTaskListFilters } = await import(
			'../server/auth.mjs'
		);
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.viewAllTasks] }],
		});
		const params = new URLSearchParams({
			crewMemberId: 'crew-2',
		});
		const req = {
			auth: { userId: 'dispatcher-1' },
		};

		await expect(
			resolveScopedTaskListFilters(req, params),
		).resolves.toEqual({
			crewMemberId: 'crew-2',
			createdByUserId: null,
		});
	});
});
