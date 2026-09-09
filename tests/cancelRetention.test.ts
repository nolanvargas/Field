/** @vitest-environment node */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';

import {
	assertRestoreWindowOpenFromArchiveAt,
	isRestoreWindowOpenFromArchiveAt,
} from '../shared/cancelRetention.js';

const purgeMocks = vi.hoisted(() => ({
	getPool: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: purgeMocks.getPool }));

const NOW = '2026-09-02T12:00:00.000Z';

const SNAPSHOT_KEYS = [
	'crewMembers',
	'contacts',
	'completionNotes',
	'history',
	'attachments',
	'documents',
	'emails',
	'crewEvents',
] as const;

const CHILD_DELETE_PATTERNS = [
	'DELETE FROM task_attachments',
	'DELETE FROM task_documents',
	'DELETE FROM email_deliveries',
	'DELETE FROM task_status_events',
	'DELETE FROM task_history_events',
	'DELETE FROM task_crew_events',
] as const;

interface ArchiveClientOptions {
	taskId?: number;
	archiveReason?: string;
	missingTask?: boolean;
	insertThrows?: boolean;
	rollbackThrows?: boolean;
}

interface ArchiveClientState {
	client: {
		query: ReturnType<typeof vi.fn>;
		release: ReturnType<typeof vi.fn>;
	};
	queries: string[];
	insertParams: unknown[] | null;
	snapshot: Record<string, unknown> | null;
	deletedChildTables: string[];
	deletedTaskIds: number[];
}

function makeArchiveClient(options: ArchiveClientOptions = {}): ArchiveClientState {
	const queries: string[] = [];
	const state: ArchiveClientState = {
		client: { query: vi.fn(), release: vi.fn() },
		queries,
		insertParams: null,
		snapshot: null,
		deletedChildTables: [],
		deletedTaskIds: [],
	};

	const query = vi.fn(async (sql: unknown, params?: unknown[]) => {
		const text = String(sql);
		queries.push(text);

		if (text.includes('INSERT INTO archived_tasks')) {
			state.insertParams = params ?? null;
			state.snapshot = JSON.parse(String(params?.[2])) as Record<string, unknown>;
			if (options.insertThrows) {
				throw new Error('INSERT failed');
			}
			return { rows: [], rowCount: 1 };
		}

		for (const pattern of CHILD_DELETE_PATTERNS) {
			if (text.startsWith(pattern)) {
				state.deletedChildTables.push(pattern);
				return { rows: [], rowCount: 1 };
			}
		}

		if (text === 'DELETE FROM tasks WHERE id = $1') {
			state.deletedTaskIds.push(Number(params?.[0]));
			return {
				rows: [],
				rowCount: options.missingTask ? 0 : 1,
			};
		}

		if (text === 'BEGIN' || text === 'COMMIT') {
			return { rows: [], rowCount: 0 };
		}

		if (text === 'ROLLBACK') {
			if (options.rollbackThrows) {
				throw new Error('ROLLBACK failed');
			}
			return { rows: [], rowCount: 0 };
		}

		if (text.startsWith('SELECT') && text.includes('FROM task_crew_members')) {
			return { rows: [{ user_id: 'u-1', is_lead: true }], rowCount: 1 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_contacts')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_completion_notes')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_history_events')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_attachments')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_documents')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM email_deliveries')) {
			return { rows: [], rowCount: 0 };
		}
		if (text.startsWith('SELECT') && text.includes('FROM task_crew_events')) {
			return { rows: [], rowCount: 0 };
		}

		return { rows: [], rowCount: 0 };
	});

	state.client.query = query;
	return state;
}

interface PurgePool {
	pool: {
		query: ReturnType<typeof vi.fn>;
		connect: ReturnType<typeof vi.fn>;
	};
	connectCount: number;
	releaseCount: number;
}

function makePurgePool(
	taskIds: number[],
	makeClient: (taskId: number) => ArchiveClientState['client'],
): PurgePool {
	let connectCount = 0;

	const pool = {
		query: vi.fn(async () => ({
			rows: taskIds.map((id) => ({ id })),
			rowCount: taskIds.length,
		})),
		connect: vi.fn(async () => {
			connectCount += 1;
			const taskId = taskIds[connectCount - 1] ?? taskIds[0];
			return makeClient(taskId);
		}),
	};

	return { pool, connectCount: 0, releaseCount: 0 };
}

async function importPurgeModule() {
	vi.resetModules();
	return import('../server/purgeCancelledTasks.mjs');
}

describe('isRestoreWindowOpenFromArchiveAt', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(NOW));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('is true before archiveAt', () => {
		expect(isRestoreWindowOpenFromArchiveAt('2026-09-08T12:00:00.000Z')).toBe(
			true,
		);
	});

	it('is false after archiveAt', () => {
		expect(isRestoreWindowOpenFromArchiveAt('2026-09-01T12:00:00.000Z')).toBe(
			false,
		);
	});

	it('is false when archiveAt equals now exactly', () => {
		expect(isRestoreWindowOpenFromArchiveAt(NOW)).toBe(false);
	});

	it('is true when archiveAt is null or undefined', () => {
		expect(isRestoreWindowOpenFromArchiveAt(null)).toBe(true);
		expect(isRestoreWindowOpenFromArchiveAt(undefined)).toBe(true);
	});

	it('is false for invalid or malformed archiveAt values', () => {
		for (const value of ['', 'not-a-date', '2026-13-99', '<script>alert(1)</script>']) {
			expect(isRestoreWindowOpenFromArchiveAt(value)).toBe(false);
		}
	});
});

describe('assertRestoreWindowOpenFromArchiveAt', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(NOW));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not throw when the restore window is open', () => {
		expect(() =>
			assertRestoreWindowOpenFromArchiveAt('2026-09-08T12:00:00.000Z'),
		).not.toThrow();
	});

	it('does not throw for null or undefined archiveAt', () => {
		expect(() => assertRestoreWindowOpenFromArchiveAt(null)).not.toThrow();
		expect(() => assertRestoreWindowOpenFromArchiveAt(undefined)).not.toThrow();
	});

	it('throws 409 with a clear message after the deadline', () => {
		expect(() =>
			assertRestoreWindowOpenFromArchiveAt('2026-09-01T12:00:00.000Z'),
		).toThrowError(
			expect.objectContaining({
				status: 409,
				message: expect.stringContaining('Restore window has expired'),
			}),
		);
	});

	it('throws 409 for invalid archiveAt (conservative closed)', () => {
		expect(() => assertRestoreWindowOpenFromArchiveAt('garbage')).toThrowError(
			expect.objectContaining({
				status: 409,
				message: expect.stringContaining('Restore window has expired'),
			}),
		);
	});
});

describe('archiveCancelledTask', () => {
	it('inserts snapshot, deletes child rows, then deletes the task', async () => {
		const { archiveCancelledTask } = await importPurgeModule();
		const archive = makeArchiveClient({ taskId: 42 });

		await archiveCancelledTask(archive.client, 42);

		expect(archive.insertParams).toEqual([
			42,
			'cancel_retention',
			expect.any(String),
		]);
		for (const key of SNAPSHOT_KEYS) {
			expect(archive.snapshot).toHaveProperty(key);
		}
		expect(archive.deletedChildTables).toEqual([...CHILD_DELETE_PATTERNS]);
		expect(archive.deletedTaskIds).toEqual([42]);
		const insertIdx = archive.queries.findIndex((q) =>
			q.includes('INSERT INTO archived_tasks'),
		);
		const taskDeleteIdx = archive.queries.findIndex(
			(q) => q === 'DELETE FROM tasks WHERE id = $1',
		);
		expect(insertIdx).toBeGreaterThan(-1);
		expect(taskDeleteIdx).toBeGreaterThan(insertIdx);
	});

	it('passes a custom archiveReason to the INSERT', async () => {
		const { archiveCancelledTask } = await importPurgeModule();
		const archive = makeArchiveClient({ taskId: 7 });

		await archiveCancelledTask(archive.client, 7, 'manual_purge');

		expect(archive.insertParams?.[1]).toBe('manual_purge');
	});

	it('throws when the task row is missing on final DELETE', async () => {
		const { archiveCancelledTask } = await importPurgeModule();
		const archive = makeArchiveClient({ taskId: 99, missingTask: true });

		await expect(archiveCancelledTask(archive.client, 99)).rejects.toThrow(
			'Task 99 not found for archive',
		);
	});
});

describe('purgeExpiredCancelledTasks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 0 and does not connect when no tasks are due', async () => {
		const pool = {
			query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
			connect: vi.fn(),
		};
		purgeMocks.getPool.mockReturnValue(pool);

		const { purgeExpiredCancelledTasks } = await importPurgeModule();
		const count = await purgeExpiredCancelledTasks();

		expect(count).toBe(0);
		expect(pool.connect).not.toHaveBeenCalled();
	});

	it('archives each due task inside BEGIN/COMMIT and releases the client', async () => {
		const clients: ArchiveClientState[] = [];
		const { pool } = makePurgePool([10, 20], (taskId) => {
			const archive = makeArchiveClient({ taskId });
			clients.push(archive);
			return archive.client;
		});
		purgeMocks.getPool.mockReturnValue(pool);

		const { purgeExpiredCancelledTasks } = await importPurgeModule();
		const count = await purgeExpiredCancelledTasks();

		expect(count).toBe(2);
		expect(pool.connect).toHaveBeenCalledTimes(2);
		for (const archive of clients) {
			expect(archive.queries).toContain('BEGIN');
			expect(archive.queries).toContain('COMMIT');
			expect(archive.client.release).toHaveBeenCalled();
		}
		expect(clients[0]!.deletedTaskIds).toEqual([10]);
		expect(clients[1]!.deletedTaskIds).toEqual([20]);
	});

	it('continues after a failed archive and returns the partial count', async () => {
		const clients: ArchiveClientState[] = [];
		const { pool } = makePurgePool([1, 2], (taskId) => {
			const archive = makeArchiveClient({
				taskId,
				insertThrows: taskId === 1,
			});
			clients.push(archive);
			return archive.client;
		});
		purgeMocks.getPool.mockReturnValue(pool);

		const { purgeExpiredCancelledTasks } = await importPurgeModule();
		const count = await purgeExpiredCancelledTasks();

		expect(count).toBe(1);
		expect(clients[0]!.queries).toContain('ROLLBACK');
		expect(clients[1]!.queries).toContain('COMMIT');
		expect(console.error).toHaveBeenCalledWith(
			'Failed to archive cancelled task 1:',
			expect.any(Error),
		);
	});

	it('still releases the client when ROLLBACK itself fails', async () => {
		const archive = makeArchiveClient({
			taskId: 5,
			insertThrows: true,
			rollbackThrows: true,
		});
		const pool = {
			query: vi.fn(async () => ({ rows: [{ id: 5 }], rowCount: 1 })),
			connect: vi.fn(async () => archive.client),
		};
		purgeMocks.getPool.mockReturnValue(pool);

		const { purgeExpiredCancelledTasks } = await importPurgeModule();
		const count = await purgeExpiredCancelledTasks();

		expect(count).toBe(0);
		expect(archive.client.release).toHaveBeenCalled();
	});
});

describe('startCancelledTaskPurgeScheduler', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('runs purge immediately and again after one hour', async () => {
		const pool = {
			query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
			connect: vi.fn(),
		};
		purgeMocks.getPool.mockReturnValue(pool);

		const { startCancelledTaskPurgeScheduler } = await importPurgeModule();
		const intervalId = startCancelledTaskPurgeScheduler();

		await vi.waitFor(() => {
			expect(pool.query).toHaveBeenCalledTimes(1);
		});

		await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
		await vi.waitFor(() => {
			expect(pool.query).toHaveBeenCalledTimes(2);
		});

		clearInterval(intervalId);
	});

	it('logs when tasks are archived and swallows purge failures', async () => {
		const pool = {
			query: vi
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 42 }], rowCount: 1 })
				.mockRejectedValueOnce(new Error('db down')),
			connect: vi.fn(async () => makeArchiveClient({ taskId: 42 }).client),
		};
		purgeMocks.getPool.mockReturnValue(pool);

		const { startCancelledTaskPurgeScheduler } = await importPurgeModule();
		const intervalId = startCancelledTaskPurgeScheduler();

		await vi.waitFor(() => {
			expect(console.log).toHaveBeenCalledWith(
				'Archived 1 cancelled task(s) past the retention window',
			);
		});

		await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
		await vi.waitFor(() => {
			expect(console.error).toHaveBeenCalledWith(
				'Cancelled task purge failed:',
				expect.any(Error),
			);
		});

		clearInterval(intervalId);
	});
});
