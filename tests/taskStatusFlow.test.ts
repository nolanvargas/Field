import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCrewEvent, updateTaskStatus } from '../server/createTask.mjs';
import {
	DELIVERY_STATUS_TRANSITIONS,
	STATUS_TRANSITIONS,
} from '../shared/statusTransitions.js';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
	maybeSendTerminalEmails: vi.fn(),
	recordTaskHistoryEvent: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/taskCompletionEmails.mjs', () => ({
	maybeSendTerminalEmails: mocks.maybeSendTerminalEmails,
}));
vi.mock('../server/taskHistory.mjs', () => ({
	recordTaskHistoryEvent: mocks.recordTaskHistoryEvent,
}));

const ALL_STATUSES = [
	'Unassigned',
	'Assigned',
	'Loaded',
	'In Progress',
	'Completed',
	'Failed',
	'Undetermined',
	'Cancelled',
];

type Row = Record<string, unknown>;
type QueryResult = { rows: Row[]; rowCount: number };

interface TaskRow {
	id: number;
	status: string;
	task_type: string;
	completed_at: string | null;
	completed_notes: string | null;
	failed_reason: string | null;
	cancelled_at: string | null;
	status_before_cancel: string | null;
	deleted_at: string | null;
}

interface CrewEventRow {
	id: number;
	task_id: number;
	user_id: string;
	event_type: string;
	latitude: number | null;
	longitude: number | null;
	accuracy_meters: number | null;
	recorded_at: string;
	created_at: string;
}

interface CompletionNoteRow {
	seq: number;
	task_id: number;
	user_id: string;
	outcome: string;
	notes: string | null;
	display_name: string;
	created_at: string;
	updated_at: string;
}

interface FakeState {
	tasks: Map<number, TaskRow>;
	crew: Map<number, Set<string>>;
	events: CrewEventRow[];
	notes: CompletionNoteRow[];
	users: Map<string, string>;
	eventSeq: number;
	noteSeq: number;
}

const now = () => new Date().toISOString();

/**
 * Minimal in-memory Postgres stand-in covering exactly the SQL that
 * updateTaskStatus / createCrewEvent emit. Matches on stable substrings
 * (same convention as tests/taskCompletionEmails.test.ts) and keeps task,
 * crew-event, and completion-note state so later queries see prior writes.
 */
function routeQuery(state: FakeState, sqlRaw: string, params?: unknown[]): QueryResult {
	const sql = sqlRaw.trim();
	const p = params ?? [];

	if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
		return { rows: [], rowCount: 0 };
	}

	// Task row read with FOR UPDATE — both functions start their transaction here.
	if (sql.includes('FOR UPDATE') && sql.includes('FROM tasks')) {
		const task = state.tasks.get(Number(p[0]));
		const row = task && task.deleted_at == null ? task : null;
		return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
	}

	if (sql.includes('DELETE FROM task_crew_events')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const before = state.events.length;
		state.events = state.events.filter(
			(e) =>
				!(e.task_id === taskId && e.user_id === userId && e.event_type === 'ended'),
		);
		return { rows: [], rowCount: before - state.events.length };
	}

	if (sql.includes('DELETE FROM task_completion_notes')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const before = state.notes.length;
		state.notes = state.notes.filter(
			(n) => !(n.task_id === taskId && n.user_id === userId),
		);
		return { rows: [], rowCount: before - state.notes.length };
	}

	// Counts query also contains `event_type = 'started'` inside its FILTER
	// clause, so match it before the started-event existence checks below.
	if (sql.includes('COUNT(*) FILTER')) {
		const taskId = Number(p[0]);
		const taskEvents = state.events.filter((e) => e.task_id === taskId);
		const started = taskEvents.filter((e) => e.event_type === 'started').length;
		const ended = taskEvents.filter((e) => e.event_type === 'ended').length;
		return {
			rows: [{ started_count: started, ended_count: ended }],
			rowCount: 1,
		};
	}

	// Started-event existence checks: `SELECT 1 …` (end gate) and `SELECT id …` (reopen).
	if (sql.includes('FROM task_crew_events') && sql.includes("event_type = 'started'")) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const found = state.events.some(
			(e) =>
				e.task_id === taskId && e.user_id === userId && e.event_type === 'started',
		);
		return { rows: found ? [{}] : [], rowCount: found ? 1 : 0 };
	}

	if (sql.includes('SELECT 1 FROM task_crew_members')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const found = state.crew.get(taskId)?.has(userId) ?? false;
		return { rows: found ? [{}] : [], rowCount: found ? 1 : 0 };
	}

	if (sql.includes('UPDATE task_crew_events')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const event = state.events.find(
			(e) =>
				e.task_id === taskId && e.user_id === userId && e.event_type === 'started',
		);
		if (event) {
			event.latitude = p[2] == null ? null : Number(p[2]);
			event.longitude = p[3] == null ? null : Number(p[3]);
			event.accuracy_meters = p[4] == null ? null : Number(p[4]);
			event.recorded_at = p[5] == null ? now() : String(p[5]);
		}
		return { rows: event ? [event] : [], rowCount: event ? 1 : 0 };
	}

	if (sql.includes('INSERT INTO task_crew_events')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const eventType = String(p[2]);
		const duplicate = state.events.some(
			(e) =>
				e.task_id === taskId && e.user_id === userId && e.event_type === eventType,
		);
		if (duplicate) {
			// Mirrors the Postgres unique constraint (task_id, user_id, event_type).
			throw Object.assign(
				new Error('duplicate key value violates unique constraint'),
				{ code: '23505' },
			);
		}
		const event: CrewEventRow = {
			id: ++state.eventSeq,
			task_id: taskId,
			user_id: userId,
			event_type: eventType,
			latitude: p[3] == null ? null : Number(p[3]),
			longitude: p[4] == null ? null : Number(p[4]),
			accuracy_meters: p[5] == null ? null : Number(p[5]),
			recorded_at: p[6] == null ? now() : String(p[6]),
			created_at: now(),
		};
		state.events.push(event);
		return { rows: [event], rowCount: 1 };
	}

	if (sql.includes('FROM task_crew_events e')) {
		const taskId = Number(p[0]);
		const rows = state.events
			.filter((e) => e.task_id === taskId && e.event_type === 'ended')
			.map((e) => {
				const note = state.notes.find(
					(n) => n.task_id === e.task_id && n.user_id === e.user_id,
				);
				return { outcome: note?.outcome ?? null };
			});
		return { rows, rowCount: rows.length };
	}

	if (sql.includes('INSERT INTO task_completion_notes')) {
		const taskId = Number(p[0]);
		const userId = String(p[1]);
		const outcome = String(p[2]);
		const notes = p[3] == null ? null : String(p[3]);
		const existing = state.notes.find(
			(n) => n.task_id === taskId && n.user_id === userId,
		);
		if (existing) {
			existing.outcome = outcome;
			existing.notes = notes;
			existing.updated_at = now();
		} else {
			state.notes.push({
				seq: ++state.noteSeq,
				task_id: taskId,
				user_id: userId,
				outcome,
				notes,
				display_name: state.users.get(userId) ?? 'Crew Member',
				created_at: now(),
				updated_at: now(),
			});
		}
		return { rows: [], rowCount: 1 };
	}

	// Aggregate rebuild select (refreshTaskNoteAggregates).
	if (sql.includes('SELECT n.outcome, n.notes, u.display_name')) {
		const taskId = Number(p[0]);
		const rows = state.notes
			.filter((n) => n.task_id === taskId)
			.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.seq - b.seq)
			.map((n) => ({
				outcome: n.outcome,
				notes: n.notes,
				display_name: n.display_name,
			}));
		return { rows, rowCount: rows.length };
	}

	// listCompletionNotes select (columns span multiple lines in the source).
	if (sql.includes('n.user_id,') && sql.includes('FROM task_completion_notes n')) {
		const taskId = Number(p[0]);
		const rows = state.notes
			.filter((n) => n.task_id === taskId)
			.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.seq - b.seq)
			.map((n) => ({
				user_id: n.user_id,
				display_name: n.display_name,
				outcome: n.outcome,
				notes: n.notes,
				created_at: n.created_at,
				updated_at: n.updated_at,
			}));
		return { rows, rowCount: rows.length };
	}

	if (sql.includes('UPDATE tasks') && sql.includes('completed_notes = $2')) {
		const task = state.tasks.get(Number(p[0]));
		const completedNotes = p[1] == null ? null : String(p[1]);
		const failedReason = p[2] == null ? null : String(p[2]);
		if (task) {
			task.completed_notes = completedNotes;
			task.failed_reason = failedReason;
		}
		return {
			rows: [{ completed_notes: completedNotes, failed_reason: failedReason }],
			rowCount: task ? 1 : 0,
		};
	}

	// Task status updates (admin PATCH branches + crew-derived updates).
	if (sql.includes('status_before_cancel')) {
		const task = state.tasks.get(Number(p[0]));
		if (task) {
			task.status_before_cancel = task.status;
			task.status = 'Cancelled';
			task.cancelled_at = now();
		}
		return { rows: task ? [task] : [], rowCount: task ? 1 : 0 };
	}
	if (sql.includes("status = 'Completed'::task_status")) {
		const task = state.tasks.get(Number(p[0]));
		if (task) {
			task.status = 'Completed';
			task.completed_at = task.completed_at ?? now();
		}
		return { rows: task ? [task] : [], rowCount: task ? 1 : 0 };
	}
	if (sql.includes('SET status = $2::task_status')) {
		const task = state.tasks.get(Number(p[0]));
		if (task) {
			task.status = String(p[1]);
			if (sql.includes('completed_at = NULL')) {
				task.completed_at = null;
			} else if (sql.includes('COALESCE(completed_at, NOW())')) {
				task.completed_at = task.completed_at ?? now();
			}
		}
		return { rows: task ? [task] : [], rowCount: task ? 1 : 0 };
	}

	throw new Error(`Unexpected query in fake DB: ${sql}`);
}

function makeDb() {
	const state: FakeState = {
		tasks: new Map(),
		crew: new Map(),
		events: [],
		notes: [],
		users: new Map(),
		eventSeq: 0,
		noteSeq: 0,
	};
	const query = (sql: string, params?: unknown[]) =>
		Promise.resolve(routeQuery(state, sql, params));
	const pool = {
		query,
		connect: async () => ({ query, release: () => {} }),
	};
	return { state, pool };
}

type Db = ReturnType<typeof makeDb>;

function addTask(
	db: Db,
	opts: { id: number; status: string; taskType?: string; crew?: string[] },
) {
	db.state.tasks.set(opts.id, {
		id: opts.id,
		status: opts.status,
		task_type: opts.taskType ?? 'Install',
		completed_at: null,
		completed_notes: null,
		failed_reason: null,
		cancelled_at: null,
		status_before_cancel: null,
		deleted_at: null,
	});
	if (opts.crew && opts.crew.length > 0) {
		db.state.crew.set(opts.id, new Set(opts.crew));
	}
}

function seedCrewTask(
	db: Db,
	opts: {
		id: number;
		status: string;
		taskType?: string;
		crew: string[];
		events?: Array<{
			userId: string;
			eventType: 'started' | 'ended';
			outcome?: string;
			notes?: string | null;
		}>;
	},
) {
	addTask(db, {
		id: opts.id,
		status: opts.status,
		taskType: opts.taskType ?? 'Install',
		crew: opts.crew,
	});
	for (const user of opts.crew) {
		if (!db.state.users.has(user)) db.state.users.set(user, `Crew ${user}`);
	}
	for (const event of opts.events ?? []) {
		db.state.events.push({
			id: ++db.state.eventSeq,
			task_id: opts.id,
			user_id: event.userId,
			event_type: event.eventType,
			latitude: null,
			longitude: null,
			accuracy_meters: null,
			recorded_at: '2026-08-12T10:00:00.000Z',
			created_at: '2026-08-12T10:00:00.000Z',
		});
		if (event.outcome) {
			db.state.notes.push({
				seq: ++db.state.noteSeq,
				task_id: opts.id,
				user_id: event.userId,
				outcome: event.outcome,
				notes: event.notes ?? null,
				display_name: db.state.users.get(event.userId) ?? 'Crew Member',
				created_at: '2026-08-12T10:00:00.000Z',
				updated_at: '2026-08-12T10:00:00.000Z',
			});
		}
	}
}

const START_BODY = {
	latitude: 36.1699,
	longitude: -115.1398,
};

let db: Db;
let taskSeq: number;

function uniqueId() {
	return taskSeq++;
}

beforeEach(() => {
	taskSeq = 1000;
	db = makeDb();
	mocks.getPool.mockReset();
	mocks.getPool.mockReturnValue(db.pool);
	mocks.maybeSendTerminalEmails.mockReset().mockResolvedValue(undefined);
	mocks.recordTaskHistoryEvent.mockReset().mockResolvedValue(1);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('updateTaskStatus — exhaustive manual transitions', () => {
	it.each([
		{ name: 'non-Delivery', taskType: 'Install', table: STATUS_TRANSITIONS },
		{ name: 'Delivery', taskType: 'Delivery', table: DELIVERY_STATUS_TRANSITIONS },
	])('$name: every allowed transition succeeds and logs history', async ({ taskType, table }) => {
		for (const [from, targets] of Object.entries(table)) {
			for (const to of targets) {
				const id = uniqueId();
				addTask(db, { id, status: from, taskType });
				const result = await updateTaskStatus(
					id,
					{ status: to, notes: to === 'Failed' ? 'reason' : undefined, userId: 'u-1' },
				);
				expect(result.status, `${from} → ${to}`).toBe(to);
				expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
					expect.anything(),
					expect.objectContaining({ fromStatus: from, toStatus: to }),
				);
			}
		}
	});

	it.each([
		{ name: 'non-Delivery', taskType: 'Install', table: STATUS_TRANSITIONS },
		{ name: 'Delivery', taskType: 'Delivery', table: DELIVERY_STATUS_TRANSITIONS },
	])('$name: every rejected transition returns 409', async ({ taskType, table }) => {
		for (const from of ALL_STATUSES) {
			for (const to of ALL_STATUSES) {
				if (to === from) continue; // same status is a no-op, not a rejection
				if (table[from].includes(to)) continue;
				const id = uniqueId();
				addTask(db, { id, status: from, taskType });
				await expect(
					updateTaskStatus(
						id,
						{ status: to, notes: to === 'Failed' ? 'reason' : undefined, userId: 'u-1' },
					),
					`${from} → ${to}`,
				).rejects.toMatchObject({ status: 409 });
			}
		}
	});
});

describe('updateTaskStatus — validation', () => {
	it('rejects unknown or empty statuses with 400', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'Assigned' });
		await expect(updateTaskStatus(id, { status: 'Bogus' })).rejects.toMatchObject({
			status: 400,
		});
		await expect(updateTaskStatus(id, { status: '' })).rejects.toMatchObject({
			status: 400,
		});
	});

	it('requires a failed reason before moving to Failed', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'In Progress' });
		await expect(updateTaskStatus(id, { status: 'Failed', userId: 'u-1' })).rejects.toMatchObject(
			{ status: 400, message: 'Failed reason is required' },
		);
	});

	it('returns 404 for unknown tasks', async () => {
		await expect(updateTaskStatus(9999, { status: 'Assigned' })).rejects.toMatchObject({
			status: 404,
		});
	});

	it('rejects a mobile session that is not assigned to the task', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await expect(
			updateTaskStatus(id, { status: 'In Progress' }, { actor: { userId: 'u-2', kind: 'device' } }),
		).rejects.toMatchObject({ status: 403 });
	});

	it('allows an assigned mobile session and records the session user as author', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		const result = await updateTaskStatus(
			id,
			{ status: 'In Progress' },
			{ actor: { userId: 'u-1', kind: 'device' } },
		);
		expect(result.status).toBe('In Progress');
		expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ actorUserId: 'u-1' }),
		);
	});

	it('keeps Cancelled terminal — PATCH never moves a cancelled task', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'Cancelled' });
		await expect(updateTaskStatus(id, { status: 'Undetermined', userId: 'u-1' })).rejects.toMatchObject(
			{ status: 409 },
		);
	});
});

describe('updateTaskStatus — same-status no-op', () => {
	it('returns the same status without logging a history event', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'In Progress' });
		const result = await updateTaskStatus(id, { status: 'In Progress', userId: 'u-1' });
		expect(result.status).toBe('In Progress');
		expect(mocks.recordTaskHistoryEvent).not.toHaveBeenCalled();
	});

	it('attaches notes when re-patching a Completed task as Completed', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'Completed' });
		db.state.users.set('u-1', 'Omar Ortiz');
		const result = await updateTaskStatus(id, {
			status: 'Completed',
			notes: 'Verified on site',
			userId: 'u-1',
		});
		expect(result.completionNotes).toEqual([
			expect.objectContaining({
				userId: 'u-1',
				displayName: 'Omar Ortiz',
				outcome: 'Completed',
				notes: 'Verified on site',
			}),
		]);
	});
});

describe('updateTaskStatus — notes on terminal transitions', () => {
	it('stores the failed reason on a non-Delivery Failed transition', async () => {
		const id = uniqueId();
		addTask(db, { id, status: 'In Progress' });
		db.state.users.set('u-1', 'Omar Ortiz');
		const result = await updateTaskStatus(id, {
			status: 'Failed',
			notes: 'Blocked at the gate',
			userId: 'u-1',
		});
		expect(result.status).toBe('Failed');
		expect(result.failedReason).toBe('Omar Ortiz: Blocked at the gate');
	});
});

describe('updateTaskStatus — Delivery vs non-Delivery differences', () => {
	it('non-Delivery Failed can move to Completed; Delivery Failed cannot', async () => {
		const installId = uniqueId();
		addTask(db, { id: installId, status: 'Failed', taskType: 'Install' });
		await expect(updateTaskStatus(installId, { status: 'Completed', userId: 'u-1' })).resolves.toMatchObject(
			{ status: 'Completed' },
		);

		const deliveryId = uniqueId();
		addTask(db, { id: deliveryId, status: 'Failed', taskType: 'Delivery' });
		await expect(updateTaskStatus(deliveryId, { status: 'Completed', userId: 'u-1' })).rejects.toMatchObject(
			{ status: 409 },
		);
	});

	it('non-Delivery Undetermined can move to Completed; Delivery Undetermined cannot', async () => {
		const installId = uniqueId();
		addTask(db, { id: installId, status: 'Undetermined', taskType: 'Install' });
		await expect(updateTaskStatus(installId, { status: 'Completed', userId: 'u-1' })).resolves.toMatchObject(
			{ status: 'Completed' },
		);

		const deliveryId = uniqueId();
		addTask(db, { id: deliveryId, status: 'Undetermined', taskType: 'Delivery' });
		await expect(updateTaskStatus(deliveryId, { status: 'Completed', userId: 'u-1' })).rejects.toMatchObject(
			{ status: 409 },
		);
	});

	it('Delivery Completed reopens only to Loaded', async () => {
		const loadedId = uniqueId();
		addTask(db, { id: loadedId, status: 'Completed', taskType: 'Delivery' });
		await expect(updateTaskStatus(loadedId, { status: 'Loaded', userId: 'u-1' })).resolves.toMatchObject(
			{ status: 'Loaded' },
		);

		const inProgressId = uniqueId();
		addTask(db, { id: inProgressId, status: 'Completed', taskType: 'Delivery' });
		await expect(updateTaskStatus(inProgressId, { status: 'In Progress', userId: 'u-1' })).rejects.toMatchObject(
			{ status: 409 },
		);
	});
});

describe('createCrewEvent — start', () => {
	it('moves a non-Delivery task to In Progress on the first start', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'started',
			...START_BODY,
		});
		expect(result.task.status).toBe('In Progress');
		expect(db.state.events).toHaveLength(1);
		expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ fromStatus: 'Assigned', toStatus: 'In Progress' }),
		);
	});

	it('moves a Delivery task to Loaded on the first start', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', taskType: 'Delivery', crew: ['u-1'] });
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'started',
			...START_BODY,
		});
		expect(result.task.status).toBe('Loaded');
	});

	it('reopens Completed to In Progress and clears the prior end + note', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'Completed',
			crew: ['u-1'],
			events: [
				{ userId: 'u-1', eventType: 'started' },
				{ userId: 'u-1', eventType: 'ended', outcome: 'Completed', notes: 'Done' },
			],
		});
		db.state.tasks.get(id)!.completed_at = '2026-08-12T10:00:00.000Z';

		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'started',
			...START_BODY,
		});

		expect(result.task.status).toBe('In Progress');
		expect(result.task.completedAt).toBeNull();
		expect(db.state.events.filter((e) => e.event_type === 'ended')).toHaveLength(0);
		expect(db.state.notes).toHaveLength(0);
		expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ fromStatus: 'Completed', toStatus: 'In Progress' }),
		);
	});

	it('reopens a completed Delivery task to Loaded', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'Completed',
			taskType: 'Delivery',
			crew: ['u-1'],
			events: [
				{ userId: 'u-1', eventType: 'started' },
				{ userId: 'u-1', eventType: 'ended', outcome: 'Completed' },
			],
		});
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'started',
			...START_BODY,
		});
		expect(result.task.status).toBe('Loaded');
	});

	it('reopens Undetermined to In Progress', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Undetermined', crew: ['u-1'] });
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'started',
			...START_BODY,
		});
		expect(result.task.status).toBe('In Progress');
	});

	it('rejects start on Failed and Cancelled tasks', async () => {
		for (const status of ['Failed', 'Cancelled']) {
			const id = uniqueId();
			seedCrewTask(db, { id, status, crew: ['u-1'] });
			await expect(
				createCrewEvent(id, { userId: 'u-1', eventType: 'started', ...START_BODY }),
			).rejects.toThrow(`Cannot log crew event on ${status} task`);
		}
	});

	it('rejects a second start while the task is active', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await createCrewEvent(id, { userId: 'u-1', eventType: 'started', ...START_BODY });
		await expect(
			createCrewEvent(id, { userId: 'u-1', eventType: 'started', ...START_BODY }),
		).rejects.toThrow('Already started this task');
	});
});

describe('createCrewEvent — end', () => {
	it('rejects ending before starting', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await expect(
			createCrewEvent(id, { userId: 'u-1', eventType: 'ended', ...START_BODY }),
		).rejects.toMatchObject({ status: 409, message: 'Cannot end task before starting' });
	});

	it('rejects a duplicate end from the same crew member', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1', 'u-2'],
			events: [
				{ userId: 'u-1', eventType: 'started' },
				{ userId: 'u-2', eventType: 'started' },
			],
		});
		await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'ended',
			outcome: 'Completed',
			...START_BODY,
		});
		// Task is still In Progress (u-2 has not ended), so a duplicate end
		// from u-1 hits the unique constraint.
		await expect(
			createCrewEvent(id, {
				userId: 'u-1',
				eventType: 'ended',
				outcome: 'Completed',
				...START_BODY,
			}),
		).rejects.toThrow('Already ended this task');
	});

	it('resolves to Completed when the only starter completes', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1'],
			events: [{ userId: 'u-1', eventType: 'started' }],
		});
		db.state.users.set('u-1', 'Omar Ortiz');
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'ended',
			outcome: 'Completed',
			notes: 'Delivered and signed',
			...START_BODY,
		});
		expect(result.task.status).toBe('Completed');
		expect(result.task.completedAt).not.toBeNull();
		expect(result.task.completedNotes).toBe('Omar Ortiz: Delivered and signed');
		expect(mocks.maybeSendTerminalEmails).toHaveBeenCalledWith(id, {
			fromStatus: 'In Progress',
			toStatus: 'Completed',
		});
	});

	it('requires a failed reason when ending as Failed', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1'],
			events: [{ userId: 'u-1', eventType: 'started' }],
		});
		await expect(
			createCrewEvent(id, {
				userId: 'u-1',
				eventType: 'ended',
				outcome: 'Failed',
				...START_BODY,
			}),
		).rejects.toMatchObject({ status: 400, message: 'Failed reason is required' });
	});

	it('resolves to Failed when the only starter fails', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1'],
			events: [{ userId: 'u-1', eventType: 'started' }],
		});
		db.state.users.set('u-1', 'Omar Ortiz');
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'ended',
			outcome: 'Failed',
			notes: 'Truck broke down',
			...START_BODY,
		});
		expect(result.task.status).toBe('Failed');
		expect(result.task.failedReason).toBe('Omar Ortiz: Truck broke down');
		expect(mocks.maybeSendTerminalEmails).toHaveBeenCalledWith(id, {
			fromStatus: 'In Progress',
			toStatus: 'Failed',
		});
	});

	it('resolves to Undetermined on mixed crew outcomes', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1', 'u-2'],
			events: [
				{ userId: 'u-1', eventType: 'started' },
				{ userId: 'u-2', eventType: 'started' },
			],
		});
		await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'ended',
			outcome: 'Completed',
			...START_BODY,
		});
		const result = await createCrewEvent(id, {
			userId: 'u-2',
			eventType: 'ended',
			outcome: 'Failed',
			notes: 'Could not access site',
			...START_BODY,
		});
		expect(result.task.status).toBe('Undetermined');
		// The caller still notifies; the email module ignores non-emailable statuses.
		expect(mocks.maybeSendTerminalEmails).toHaveBeenCalledWith(id, {
			fromStatus: 'In Progress',
			toStatus: 'Undetermined',
		});
	});

	it('does not let unstarted assigned crew block completion', async () => {
		const id = uniqueId();
		seedCrewTask(db, {
			id,
			status: 'In Progress',
			crew: ['u-1', 'u-2'],
			events: [{ userId: 'u-1', eventType: 'started' }],
		});
		const result = await createCrewEvent(id, {
			userId: 'u-1',
			eventType: 'ended',
			outcome: 'Completed',
			...START_BODY,
		});
		expect(result.task.status).toBe('Completed');
	});
});

describe('createCrewEvent — validation & scoping', () => {
	it('requires latitude and longitude', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await expect(createCrewEvent(id, { userId: 'u-1', eventType: 'started' })).rejects.toMatchObject(
			{ status: 400 },
		);
	});

	it('rejects unknown event types', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await expect(
			createCrewEvent(id, { userId: 'u-1', eventType: 'paused', ...START_BODY }),
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects events from users not assigned to the task', async () => {
		const id = uniqueId();
		seedCrewTask(db, { id, status: 'Assigned', crew: ['u-1'] });
		await expect(
			createCrewEvent(id, { userId: 'u-2', eventType: 'started', ...START_BODY }),
		).rejects.toMatchObject({ status: 403 });
	});

	it('returns 404 for unknown tasks', async () => {
		await expect(
			createCrewEvent(2017, { userId: 'u-1', eventType: 'started', ...START_BODY }),
		).rejects.toMatchObject({ status: 404 });
	});
});
