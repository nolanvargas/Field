/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createTask,
	endOpenCrewStarts,
	updateTask,
} from '../server/createTask.mjs';

const mocks = vi.hoisted(() => ({
	getPool: vi.fn(),
	getOrgSettings: vi.fn(),
	recordTaskHistoryEvent: vi.fn(),
	generateTrackingToken: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({ getPool: mocks.getPool }));
vi.mock('../server/orgSettings.mjs', () => ({
	getOrgSettings: mocks.getOrgSettings,
	resolveTaskTypeForWrite: vi.fn(async (_client, body, org, opts = {}) => {
		const taskTypeId =
			body.taskTypeId != null ? Number(body.taskTypeId) : 1;
		const { rows } = await _client.query(
			`SELECT id, name, slug, retired_at FROM org_task_types WHERE id = $1`,
			[taskTypeId],
		);
		const row = rows[0];
		if (!row) {
			throw Object.assign(new Error(`Invalid taskTypeId: ${taskTypeId}`), {
				status: 400,
			});
		}
		const isRetired = row.retired_at != null;
		const existingTaskTypeId =
			opts.existingTaskTypeId != null ? Number(opts.existingTaskTypeId) : null;
		const isExisting =
			existingTaskTypeId != null && taskTypeId === existingTaskTypeId;
		if (isRetired && !isExisting) {
			const allowRetiredClone =
				body.allowRetiredTaskType === true &&
				taskTypeId === Number(body.taskTypeId);
			if (!allowRetiredClone) {
				throw Object.assign(
					new Error('Cannot assign a retired task type to this task'),
					{ status: 400 },
				);
			}
		}
		return { taskTypeId, taskTypeName: String(row.name) };
	}),
}));
vi.mock('../server/taskHistory.mjs', () => ({
	recordTaskHistoryEvent: mocks.recordTaskHistoryEvent,
}));
vi.mock('../server/trackingToken.mjs', () => ({
	generateTrackingToken: mocks.generateTrackingToken,
}));
vi.mock('../server/taskCompletionEmails.mjs', () => ({
	maybeSendTerminalEmails: vi.fn(),
}));
vi.mock('../server/taskCrewPush.mjs', () => ({
	loadTaskPushContext: vi.fn(async (taskId: number) => ({
		taskId,
		externalKey: null,
		windowStartAt: null,
		windowEndAt: null,
		destinationName: '',
		destinationAddress: '',
		crewIds: [],
	})),
	notifyTaskAssigned: vi.fn(async () => {}),
	notifyTaskUpdated: vi.fn(async () => {}),
}));
vi.mock('../server/taskAccess.mjs', () => ({
	assertUserAssignedToTask: vi.fn(),
}));

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const CREW_ID = '660e8400-e29b-41d4-a716-446655440001';
const TRACKING_TOKEN = 'generated-tracking-token';
const EXISTING_TRACKING_TOKEN = 'existing-token';

const defaultOrg = {
	externalKeyLabel: 'Job',
	requiredTaskFields: [] as string[],
	customFieldDefs: { task: [] as unknown[] },
	taskTypes: [
		{
			id: 1,
			name: 'Delivery',
			slug: 'delivery',
			enabled: true,
			sortOrder: 0,
		},
	],
};

interface FakeState {
	nextTaskId: number;
	tasks: Map<
		number,
		{
			id: number;
			status: string;
			task_type: string;
			task_type_id: number;
			tracking_token: string;
			deleted_at: string | null;
			custom_fields?: Record<string, unknown>;
			custom_field_defs_snapshot?: unknown[];
			description?: string | null;
			job_title?: string | null;
			external_key?: string | null;
			window_start_at?: string | null;
			window_end_at?: string | null;
			destination_address_id?: number | null;
			destination_address_name?: string | null;
			destination_address?: string | null;
			destination_building?: string | null;
			destination_notes?: string | null;
		}
	>;
	taskContacts: Array<{
		task_id: number;
		contact_id: number;
		is_poc: boolean;
		receives_email: boolean;
	}>;
	taskCrew: Array<{
		task_id: number;
		user_id: string;
		is_lead: boolean;
	}>;
	crewEvents: Array<{
		task_id: number;
		user_id: string;
		event_type: string;
	}>;
	activeUsers: Set<string>;
	activeContacts: Set<number>;
	taskTypes: Map<
		number,
		{ id: number; name: string; slug: string; retired_at: string | null }
	>;
}

function makeState(overrides: Partial<FakeState> = {}): FakeState {
	const state: FakeState = {
		nextTaskId: 100,
		tasks: new Map(),
		taskContacts: [],
		taskCrew: [],
		crewEvents: [],
		activeUsers: new Set([USER_ID, CREW_ID]),
		activeContacts: new Set([1, 2]),
		taskTypes: new Map([
			[1, { id: 1, name: 'Delivery', slug: 'delivery', retired_at: null }],
			[
				9,
				{
					id: 9,
					name: 'Legacy',
					slug: 'legacy',
					retired_at: '2026-01-01T00:00:00.000Z',
				},
			],
		]),
		...overrides,
	};
	return state;
}

function routeClientQuery(state: FakeState, sql: string, params: unknown[] = []) {
	const text = sql.trim();

	if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
		return { rows: [], rowCount: 0 };
	}

	if (text.includes('FROM users WHERE id = $1 AND is_active = true')) {
		const found = state.activeUsers.has(String(params[0]));
		return { rows: found ? [{ id: params[0] }] : [], rowCount: found ? 1 : 0 };
	}

	if (text.includes('FROM users') && text.includes('ANY($1::uuid[])')) {
		const ids = (params[0] as string[]) ?? [];
		const rows = ids
			.filter((id) => state.activeUsers.has(id))
			.map((id) => ({ id }));
		return { rows, rowCount: rows.length };
	}

	if (text.includes('FROM contacts') && text.includes('ANY($1::bigint[])')) {
		const ids = (params[0] as number[]) ?? [];
		const rows = ids
			.filter((id) => state.activeContacts.has(id))
			.map((id) => ({ id }));
		return { rows, rowCount: rows.length };
	}

	if (text.includes('FROM org_task_types WHERE id = $1')) {
		const row = state.taskTypes.get(Number(params[0]));
		return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
	}

	if (text.includes('INSERT INTO tasks')) {
		const id = state.nextTaskId++;
		const trackingToken = String(params[18] ?? TRACKING_TOKEN);
		const row = {
			id,
			status: params[2],
			task_type: params[0],
			task_type_id: params[1],
			destination_address_id: params[7],
			tracking_token: trackingToken,
			deleted_at: null,
		};
		state.tasks.set(id, row);
		return { rows: [row], rowCount: 1 };
	}

	if (text.includes('INSERT INTO task_contacts')) {
		state.taskContacts.push({
			task_id: Number(params[0]),
			contact_id: Number(params[1]),
			is_poc: Boolean(params[2]),
			receives_email: Boolean(params[3]),
		});
		return { rows: [], rowCount: 1 };
	}

	if (text.includes('INSERT INTO task_crew_members')) {
		state.taskCrew.push({
			task_id: Number(params[0]),
			user_id: String(params[1]),
			is_lead: Boolean(params[2]),
		});
		return { rows: [], rowCount: 1 };
	}

	if (text.includes('FROM task_contacts') && text.includes('WHERE task_id = $1')) {
		const taskId = Number(params[0]);
		const rows = state.taskContacts
			.filter((c) => c.task_id === taskId)
			.sort((a, b) => a.contact_id - b.contact_id)
			.map((c) => ({ contact_id: String(c.contact_id) }));
		return { rows, rowCount: rows.length };
	}

	if (text.includes('FROM task_crew_members') && text.includes('WHERE task_id = $1')) {
		const taskId = Number(params[0]);
		const rows = state.taskCrew
			.filter((c) => c.task_id === taskId)
			.sort((a, b) => a.user_id.localeCompare(b.user_id))
			.map((c) => ({ user_id: c.user_id }));
		return { rows, rowCount: rows.length };
	}

	if (text.includes('FROM tasks WHERE id = $1') && text.includes('FOR UPDATE')) {
		const task = state.tasks.get(Number(params[0]));
		const row =
			task && task.deleted_at == null
				? {
						id: task.id,
						status: task.status,
						task_type: task.task_type,
						task_type_id: task.task_type_id,
						custom_fields: task.custom_fields ?? {},
						custom_field_defs_snapshot:
							task.custom_field_defs_snapshot ?? [],
						description: task.description ?? null,
						job_title: task.job_title ?? null,
						external_key: task.external_key ?? null,
						destination_address_id: task.destination_address_id ?? null,
						destination_address_name: task.destination_address_name ?? null,
						destination_address: task.destination_address ?? null,
						destination_building: task.destination_building ?? null,
						destination_notes: task.destination_notes ?? null,
						window_start_at: task.window_start_at ?? null,
						window_end_at: task.window_end_at ?? null,
					}
				: null;
		return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
	}

	if (text.includes('UPDATE tasks SET')) {
		const taskId = Number(params[0]);
		const task = state.tasks.get(taskId);
		if (task) {
			if (params[3]) task.status = String(params[3]);
			task.task_type = String(params[1]);
			task.task_type_id = Number(params[2]);
			task.description = params[4] != null ? String(params[4]) : null;
			task.job_title = params[5] != null ? String(params[5]) : null;
			task.external_key = params[6] != null ? String(params[6]) : null;
			task.destination_address_id =
				params[7] != null ? Number(params[7]) : null;
			if (params[16] != null) {
				task.window_start_at = String(params[16]);
			} else {
				task.window_start_at = null;
			}
			if (params[17] != null) {
				task.window_end_at = String(params[17]);
			} else {
				task.window_end_at = null;
			}
			if (params[14] != null) {
				task.custom_fields = JSON.parse(String(params[14])) as Record<
					string,
					unknown
				>;
			}
			if (params[15] != null) {
				task.custom_field_defs_snapshot = JSON.parse(
					String(params[15]),
				) as unknown[];
			}
		}
		return {
			rows: task
				? [
						{
							id: task.id,
							status: task.status,
							task_type: task.task_type,
							task_type_id: task.task_type_id,
							destination_address_id: null,
						},
					]
				: [],
			rowCount: task ? 1 : 0,
		};
	}

	if (text.includes('DELETE FROM task_contacts WHERE task_id = $1')) {
		const taskId = Number(params[0]);
		state.taskContacts = state.taskContacts.filter((c) => c.task_id !== taskId);
		return { rows: [], rowCount: 0 };
	}

	if (text.includes('DELETE FROM task_crew_members WHERE task_id = $1')) {
		const taskId = Number(params[0]);
		state.taskCrew = state.taskCrew.filter((c) => c.task_id !== taskId);
		return { rows: [], rowCount: 0 };
	}

	if (text.includes('INSERT INTO task_crew_events') && text.includes("'ended'")) {
		const taskId = Number(params[0]);
		const openStarts = state.crewEvents.filter(
			(e) =>
				e.task_id === taskId &&
				e.event_type === 'started' &&
				!state.crewEvents.some(
					(end) =>
						end.task_id === e.task_id &&
						end.user_id === e.user_id &&
						end.event_type === 'ended',
				),
		);
		for (const start of openStarts) {
			state.crewEvents.push({
				task_id: start.task_id,
				user_id: start.user_id,
				event_type: 'ended',
			});
		}
		return { rows: [], rowCount: openStarts.length };
	}

	throw new Error(`Unexpected query: ${text.slice(0, 160)}`);
}

function installPool(state: FakeState) {
	const client = {
		query: vi.fn((sql: string, params?: unknown[]) =>
			Promise.resolve(routeClientQuery(state, sql, params ?? [])),
		),
		release: vi.fn(),
	};
	mocks.getPool.mockReturnValue({
		connect: vi.fn(async () => client),
		query: client.query,
	});
	return client;
}

describe('createTask', () => {
	beforeEach(() => {
		mocks.getOrgSettings.mockResolvedValue(defaultOrg);
		mocks.generateTrackingToken.mockReturnValue(TRACKING_TOKEN);
	});

	it('requires createdByUserId', async () => {
		installPool(makeState());
		await expect(createTask({ taskTypeId: 1 })).rejects.toMatchObject({
			message: 'createdByUserId is required',
			status: 400,
		});
	});

	it('mints a tracking token on create', async () => {
		const state = makeState();
		installPool(state);
		const created = await createTask({
			createdByUserId: USER_ID,
			taskTypeId: 1,
			taskDesc: 'Deliver goods',
		});
		expect(mocks.generateTrackingToken).toHaveBeenCalled();
		expect(created.trackingToken).toBe(TRACKING_TOKEN);
	});

	it('defaults POC to first contact and receives_email to POC only', async () => {
		const state = makeState();
		installPool(state);
		await createTask({
			createdByUserId: USER_ID,
			taskTypeId: 1,
			contactIds: [1, 2],
		});

		const contacts = state.taskContacts.filter((c) => c.task_id === 100);
		expect(contacts).toEqual([
			{ task_id: 100, contact_id: 1, is_poc: true, receives_email: true },
			{ task_id: 100, contact_id: 2, is_poc: false, receives_email: false },
		]);
	});

	it('rejects retired task types', async () => {
		installPool(makeState());
		await expect(
			createTask({
				createdByUserId: USER_ID,
				taskTypeId: 9,
			}),
		).rejects.toMatchObject({
			message: 'Cannot assign a retired task type to this task',
			status: 400,
		});
	});
});

describe('updateTask', () => {
	beforeEach(() => {
		mocks.getOrgSettings.mockResolvedValue(defaultOrg);
		mocks.recordTaskHistoryEvent.mockReset().mockResolvedValue(1);
	});

	it('returns 404 for missing tasks', async () => {
		installPool(makeState());
		await expect(
			updateTask(999, {
				createdByUserId: USER_ID,
				taskTypeId: 1,
				contactIds: [],
				crewMemberIds: [],
			}),
		).rejects.toMatchObject({ message: 'Task not found', status: 404 });
	});

	it('updates editable fields and toggles Assigned/Unassigned from crew', async () => {
		const state = makeState();
		state.tasks.set(50, {
			id: 50,
			status: 'Unassigned',
			task_type: 'Delivery',
			task_type_id: 1,
			tracking_token: EXISTING_TRACKING_TOKEN,
			deleted_at: null,
		});
		installPool(state);

		const updated = await updateTask(50, {
			createdByUserId: USER_ID,
			taskTypeId: 1,
			jobTitle: 'Updated title',
			contactIds: [2],
			pocContactId: 2,
			crewMemberIds: [CREW_ID],
			leadCrewMemberId: CREW_ID,
		});

		expect(updated.status).toBe('Assigned');
		expect(updated.pocContactId).toBe(2);
		expect(updated.leadCrewMemberId).toBe(CREW_ID);
		expect(state.taskCrew.some((c) => c.task_id === 50 && c.is_lead)).toBe(
			true,
		);
		expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				taskId: 50,
				eventType: 'task_edited',
				summary: expect.stringContaining('Crew assignment updated'),
			}),
		);
	});

	it('records schedule changes in task history', async () => {
		const state = makeState();
		state.tasks.set(50, {
			id: 50,
			status: 'Assigned',
			task_type: 'Delivery',
			task_type_id: 1,
			tracking_token: EXISTING_TRACKING_TOKEN,
			deleted_at: null,
			window_start_at: '2026-07-29T17:00:00.000Z',
		});
		state.taskCrew.push({
			task_id: 50,
			user_id: CREW_ID,
			is_lead: true,
		});
		installPool(state);

		await updateTask(
			50,
			{
				taskTypeId: 1,
				contactIds: [],
				crewMemberIds: [CREW_ID],
				afterDateTime: '2026-07-29T16:00:00.000Z',
			},
			{ actorUserId: USER_ID },
		);

		expect(mocks.recordTaskHistoryEvent).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				taskId: 50,
				eventType: 'task_edited',
				actorUserId: USER_ID,
				summary: expect.stringMatching(/^Start: .+ → .+$/),
			}),
		);
	});

	it('extends TCFS when a new custom field value is saved', async () => {
		mocks.getOrgSettings.mockResolvedValue({
			...defaultOrg,
			customFieldDefs: {
				task: [
					{
						slot: 2,
						label: 'New field',
						dataType: 'text',
						required: false,
						lookupTable: null,
						options: [],
					},
				],
			},
		});
		const state = makeState();
		state.tasks.set(50, {
			id: 50,
			status: 'Unassigned',
			task_type: 'Delivery',
			task_type_id: 1,
			tracking_token: EXISTING_TRACKING_TOKEN,
			deleted_at: null,
			custom_fields: {},
			custom_field_defs_snapshot: [],
		});
		installPool(state);

		await updateTask(50, {
			taskTypeId: 1,
			contactIds: [],
			crewMemberIds: [],
			customFields: { '2': 'hello' },
			touchedCustomFieldSlots: [2],
			clearedCustomFieldSlots: [],
		});

		const task = state.tasks.get(50);
		expect(task?.custom_fields).toEqual({ '2': 'hello' });
		expect(task?.custom_field_defs_snapshot).toEqual([
			expect.objectContaining({ slot: 2, label: 'New field', dataType: 'text' }),
		]);
	});
});

describe('endOpenCrewStarts', () => {
	it('inserts ended events for every open started crew member', async () => {
		const state = makeState();
		state.crewEvents.push(
			{ task_id: 7, user_id: CREW_ID, event_type: 'started' },
			{ task_id: 7, user_id: USER_ID, event_type: 'started' },
			{ task_id: 7, user_id: USER_ID, event_type: 'ended' },
		);
		const client = {
			query: vi.fn((sql: string, params?: unknown[]) =>
				Promise.resolve(routeClientQuery(state, sql, params ?? [])),
			),
		};

		const ended = await endOpenCrewStarts(client, 7);
		expect(ended).toBe(1);
		expect(
			state.crewEvents.filter(
				(e) => e.task_id === 7 && e.user_id === CREW_ID && e.event_type === 'ended',
			),
		).toHaveLength(1);
	});
});
