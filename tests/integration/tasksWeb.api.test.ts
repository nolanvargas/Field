/** @vitest-environment node */
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
} from 'vitest';
import { startTestApi } from './helpers/api.mjs';
import { isPostgresReachable, withCommittedDb } from './helpers/db.mjs';
import {
	cleanupIntegrationFixtures,
	FIXTURE_USERS,
	seedIntegrationFixtures,
	writeIntegrationStorageFile,
} from './helpers/fixtures.mjs';

const postgresUp = await isPostgresReachable();

const minimalCreateBody = {
	taskType: 'Delivery',
	taskDesc: 'Integration test — web create',
	externalKey: 'inttest-web-create',
};

describe.skipIf(!postgresUp)('web task API', () => {
	/** @type {import('./helpers/api.mjs').TestApi} */
	let api;

	beforeAll(async () => {
		api = await startTestApi();
	});

	afterAll(async () => {
		await api.close();
	});

	afterEach(async () => {
		await withCommittedDb(cleanupIntegrationFixtures);
	});

	it('POST /api/tasks — requires Bearer when FIELD_API_REQUIRE_AUTH=1', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);

			const res = await api.fetch('/api/tasks', {
				method: 'POST',
				body: JSON.stringify({
					...minimalCreateBody,
					createdByUserId: FIXTURE_USERS.logan,
				}),
			});
			expect(res.status).toBe(401);
		});
	});

	it('POST /api/tasks — creates task and persists crew assignment', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);

			const res = await api.authFetch(FIXTURE_USERS.logan, '/api/tasks', {
				method: 'POST',
				body: JSON.stringify({
					...minimalCreateBody,
					externalKey: 'inttest-web-create-assigned',
					createdByUserId: FIXTURE_USERS.logan,
					crewMemberIds: [FIXTURE_USERS.alex],
					leadCrewMemberId: FIXTURE_USERS.alex,
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json();
			expect(body.task?.id).toBeTruthy();
			expect(body.task.status).toBe('Assigned');

			const row = await client.query(
				`SELECT status::text AS status, external_key
         FROM tasks WHERE id = $1`,
				[body.task.id],
			);
			expect(row.rows[0]?.status).toBe('Assigned');
			expect(row.rows[0]?.external_key).toBe('inttest-web-create-assigned');

			const crew = await client.query(
				`SELECT user_id::text AS user_id FROM task_crew_members WHERE task_id = $1`,
				[body.task.id],
			);
			expect(crew.rows.map((r) => r.user_id)).toContain(FIXTURE_USERS.alex);
		});
	});

	it('GET /api/tasks/:id — view_all_tasks vs assigned-only', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId } =
				await seedIntegrationFixtures(client);

			const loganRes = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${blakeTaskId}`,
			);
			expect(loganRes.status).toBe(200);

			const alexAllowed = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}`,
			);
			expect(alexAllowed.status).toBe(200);

			const alexDenied = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${blakeTaskId}`,
			);
			expect(alexDenied.status).toBe(403);
		});
	});

	it('PATCH /api/tasks/:id/status — web user with access updates status', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Assigned' }),
				},
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			expect(body.task.status).toBe('Assigned');

			const row = await client.query(
				`SELECT status::text AS status FROM tasks WHERE id = $1`,
				[alexTaskId],
			);
			expect(row.rows[0]?.status).toBe('Assigned');
		});
	});

	it('PATCH /api/tasks/:id/status — crew web user forbidden on unassigned task', async () => {
		await withCommittedDb(async (client) => {
			const { blakeTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${blakeTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Assigned' }),
				},
			);
			expect(res.status).toBe(403);
		});
	});

	it('GET /api/tasks/:id/attachments — list scoped like task detail', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId } =
				await seedIntegrationFixtures(client);

			const allowed = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments`,
			);
			expect(allowed.status).toBe(200);
			const list = await allowed.json();
			expect(Array.isArray(list.attachments)).toBe(true);

			const denied = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${blakeTaskId}/attachments`,
			);
			expect(denied.status).toBe(403);
		});
	});

	it('POST /api/tasks/:id/attachments/presign — forbidden without task access', async () => {
		await withCommittedDb(async (client) => {
			const { blakeTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${blakeTaskId}/attachments/presign`,
				{
					method: 'POST',
					body: JSON.stringify({
						fileName: 'inttest-photo.jpg',
						mimeType: 'image/jpeg',
						fileSizeBytes: 1024,
					}),
				},
			);
			expect(res.status).toBe(403);
		});
	});

	it('POST /api/tasks/:id/attachments — presign, upload, confirm on assigned task', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);

			const presignRes = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments/presign`,
				{
					method: 'POST',
					body: JSON.stringify({
						fileName: 'inttest-photo.jpg',
						mimeType: 'image/jpeg',
						fileSizeBytes: 1024,
					}),
				},
			);
			expect(presignRes.status).toBe(200);
			const presign = await presignRes.json();
			await writeIntegrationStorageFile(presign.storageKey, 1024);

			const confirmRes = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments`,
				{
					method: 'POST',
					body: JSON.stringify({
						storageKey: presign.storageKey,
						fileName: 'inttest-photo.jpg',
						mimeType: 'image/jpeg',
						fileSizeBytes: 1024,
					}),
				},
			);
			expect(confirmRes.status).toBe(201);
			const confirmed = await confirmRes.json();
			expect(confirmed.attachment?.taskId).toBe(alexTaskId);

			const listRes = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments`,
			);
			const list = await listRes.json();
			expect(list.attachments).toHaveLength(1);
			expect(list.attachments[0]?.uploadedByUserId).toBe(FIXTURE_USERS.alex);
		});
	});

	it('POST /api/tasks/:id/attachments — ignores body uploadedByUserId when Bearer present', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);

			const presignRes = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments/presign`,
				{
					method: 'POST',
					body: JSON.stringify({
						fileName: 'inttest-spoof.jpg',
						mimeType: 'image/jpeg',
						fileSizeBytes: 512,
						uploadedByUserId: FIXTURE_USERS.logan,
					}),
				},
			);
			expect(presignRes.status).toBe(200);
			const presign = await presignRes.json();
			await writeIntegrationStorageFile(presign.storageKey, 512);

			const confirmRes = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/attachments`,
				{
					method: 'POST',
					body: JSON.stringify({
						storageKey: presign.storageKey,
						fileName: 'inttest-spoof.jpg',
						mimeType: 'image/jpeg',
						fileSizeBytes: 512,
						uploadedByUserId: FIXTURE_USERS.logan,
					}),
				},
			);
			expect(confirmRes.status).toBe(201);
			const confirmed = await confirmRes.json();
			expect(confirmed.attachment?.uploadedByUserId).toBe(FIXTURE_USERS.alex);
		});
	});

	it('POST /api/print/:type — task PDF forbidden without task access', async () => {
		await withCommittedDb(async (client) => {
			const { blakeTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.alex,
				'/api/print/delivery_docket',
				{
					method: 'POST',
					body: JSON.stringify({
						context: 'task',
						taskId: blakeTaskId,
					}),
				},
			);
			expect(res.status).toBe(403);
		});
	});

	it('POST /api/tasks/:id/crew-events — web user forbidden on unassigned task', async () => {
		await withCommittedDb(async (client) => {
			const { blakeTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${blakeTaskId}/crew-events`,
				{
					method: 'POST',
					body: JSON.stringify({
						userId: FIXTURE_USERS.alex,
						eventType: 'started',
						latitude: 36.1,
						longitude: -115.17,
					}),
				},
			);
			expect(res.status).toBe(403);
		});
	});

	it('POST /api/tasks/:id/crew-events — web user with access can start', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);

			const res = await api.authFetch(
				FIXTURE_USERS.alex,
				`/api/tasks/${alexTaskId}/crew-events`,
				{
					method: 'POST',
					body: JSON.stringify({
						userId: FIXTURE_USERS.alex,
						eventType: 'started',
						latitude: 36.1,
						longitude: -115.17,
					}),
				},
			);
			expect(res.status).toBe(201);

			const row = await client.query(
				`SELECT COUNT(*)::int AS n FROM task_crew_events WHERE task_id = $1`,
				[alexTaskId],
			);
			expect(row.rows[0]?.n).toBe(1);
		});
	});
});
