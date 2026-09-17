/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTrackingPageHistory } from '../server/taskHistory.mjs';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));

function makePool(rows: Record<string, unknown>[]) {
	return {
		query: vi.fn(async (sql: string) => {
			if (sql.includes('SELECT 1 FROM tasks')) {
				return { rows: [{}], rowCount: 1 };
			}
			if (sql.includes('SELECT * FROM (')) {
				return { rows, rowCount: rows.length };
			}
			throw new Error(`Unexpected query: ${sql}`);
		}),
	};
}

describe('getTrackingPageHistory', () => {
	beforeEach(() => {
		mocks.getPool.mockReset();
	});

	it('rejects invalid task ids', async () => {
		await expect(getTrackingPageHistory(0)).rejects.toMatchObject({
			message: 'Invalid task id',
			status: 400,
		});
	});

	it('returns 404 when the task does not exist', async () => {
		mocks.getPool.mockReturnValue({
			query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
		});
		await expect(getTrackingPageHistory(99)).rejects.toMatchObject({
			message: 'Task not found',
			status: 404,
		});
	});

	it('maps created and status events to customer-safe titles', async () => {
		mocks.getPool.mockReturnValue(
			makePool([
				{
					id: 'created:1',
					event_type: 'created',
					recorded_at: '2026-09-01T10:00:00.000Z',
					from_status: null,
					to_status: null,
					detail: null,
				},
				{
					id: 'history:2',
					event_type: 'status_changed',
					recorded_at: '2026-09-01T11:00:00.000Z',
					from_status: 'Assigned',
					to_status: 'In Progress',
					detail: null,
				},
				{
					id: 'history:3',
					event_type: 'cancelled',
					recorded_at: '2026-09-01T12:00:00.000Z',
					from_status: 'In Progress',
					to_status: null,
					detail: null,
				},
			]),
		);

		const history = await getTrackingPageHistory(1);
		expect(history.map((e) => e.title)).toEqual([
			'Order received',
			'Status Assigned → In Progress',
			'Cancelled (was In Progress)',
		]);
		expect(history.every((e) => !('actorName' in e))).toBe(true);
		expect(history.every((e) => !('latitude' in e))).toBe(true);
	});

	it('includes only safe document kinds with readable titles', async () => {
		mocks.getPool.mockReturnValue(
			makePool([
				{
					id: 'document:1',
					event_type: 'document_generated',
					recorded_at: '2026-09-01T13:00:00.000Z',
					from_status: null,
					to_status: null,
					detail: 'proof_of_completion',
				},
			]),
		);

		const history = await getTrackingPageHistory(1);
		expect(history).toHaveLength(1);
		expect(history[0].title).toBe('Proof of completion available');
		expect(history[0].detail).toBe('proof_of_completion');
	});

	it('passes public document kinds to the query (delivery docket Delivery-only in SQL)', async () => {
		const query = vi.fn(async (sql: string, params?: unknown[]) => {
			if (sql.includes('SELECT 1 FROM tasks')) {
				return { rows: [{}], rowCount: 1 };
			}
			if (sql.includes('SELECT * FROM (')) {
				expect(params?.[1]).toEqual([
					'delivery_docket',
					'proof_of_completion',
				]);
				return { rows: [], rowCount: 0 };
			}
			throw new Error(`Unexpected query: ${sql}`);
		});
		mocks.getPool.mockReturnValue({ query });

		await getTrackingPageHistory(1);
		expect(query).toHaveBeenCalledTimes(2);
	});
});
