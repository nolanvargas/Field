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
	insertActivationCode,
	seedIntegrationFixtures,
} from './helpers/fixtures.mjs';

const postgresUp = await isPostgresReachable();

/**
 * @param {import('./helpers/api.mjs').TestApi} api
 * @param {import('pg').Client} client
 */
async function activateAlex(api, client) {
	const { code } = await insertActivationCode(
		client,
		FIXTURE_USERS.alex,
		FIXTURE_USERS.logan,
	);
	const res = await api.fetch('/api/mobile/activate', {
		method: 'POST',
		body: JSON.stringify({ code }),
	});
	expect(res.status).toBe(200);
	const body = await res.json();
	return body.deviceSessionToken as string;
}

describe.skipIf(!postgresUp)('mobile crew scoping API', () => {
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

	it('GET /api/tasks returns Alex-assigned and Alex-created tasks', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId, alexCreatedTaskId } =
				await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const res = await api.deviceFetch(
				token,
				`/api/tasks?crewMemberId=${FIXTURE_USERS.blake}`,
			);
			expect(res.status).toBe(200);
			const body = await res.json();
			const ids = body.tasks.map((task: { id: number }) => task.id);
			expect(ids).toContain(alexTaskId);
			expect(ids).toContain(alexCreatedTaskId);
			expect(ids).not.toContain(blakeTaskId);
		});
	});

	it('GET /api/tasks/:id — assigned 200, unassigned 403', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId } =
				await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const allowed = await api.deviceFetch(token, `/api/tasks/${alexTaskId}`);
			expect(allowed.status).toBe(200);

			const denied = await api.deviceFetch(token, `/api/tasks/${blakeTaskId}`);
			expect(denied.status).toBe(403);
		});
	});

	it('PATCH /api/tasks/:id/status — assigned 200, unassigned 403', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId } =
				await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const allowed = await api.deviceFetch(
				token,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Assigned' }),
				},
			);
			expect(allowed.status).toBe(200);

			const denied = await api.deviceFetch(
				token,
				`/api/tasks/${blakeTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Assigned' }),
				},
			);
			expect(denied.status).toBe(403);
		});
	});

	it('POST /api/tasks/:id/crew-events — assigned 201, unassigned 403', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId, blakeTaskId } =
				await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const allowed = await api.deviceFetch(
				token,
				`/api/tasks/${alexTaskId}/crew-events`,
				{
					method: 'POST',
					body: JSON.stringify({
						eventType: 'started',
						latitude: 36.1,
						longitude: -115.17,
					}),
				},
			);
			expect(allowed.status).toBe(201);

			const denied = await api.deviceFetch(
				token,
				`/api/tasks/${blakeTaskId}/crew-events`,
				{
					method: 'POST',
					body: JSON.stringify({
						eventType: 'started',
						latitude: 36.1,
						longitude: -115.17,
					}),
				},
			);
			expect(denied.status).toBe(403);
		});
	});

	it('POST /api/tasks — mobile device session forbidden', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const res = await api.deviceFetch(token, '/api/tasks', {
				method: 'POST',
				body: JSON.stringify({
					taskType: 'Delivery',
					taskDesc: 'Should not create',
					externalKey: 'inttest-mobile-create-deny',
					createdByUserId: FIXTURE_USERS.alex,
				}),
			});
			expect(res.status).toBe(403);
		});
	});

	it('PUT /api/tasks/:id — mobile device session forbidden', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const res = await api.deviceFetch(token, `/api/tasks/${alexTaskId}`, {
				method: 'PUT',
				body: JSON.stringify({ taskDesc: 'Mobile edit attempt' }),
			});
			expect(res.status).toBe(403);
		});
	});

	it('POST /api/tasks — IdP identity (test bearer) allowed', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);

			const res = await api.authFetch(FIXTURE_USERS.logan, '/api/tasks', {
				method: 'POST',
				body: JSON.stringify({
					taskType: 'Delivery',
					taskDesc: 'Created via IdP bearer',
					externalKey: 'inttest-idp-create-ok',
					createdByUserId: FIXTURE_USERS.logan,
				}),
			});
			expect(res.status).toBe(201);
		});
	});

	it('PUT /api/org/settings — device session forbidden, IdP allowed', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
			const token = await activateAlex(api, client);

			const denied = await api.deviceFetch(token, '/api/org/settings', {
				method: 'PUT',
				body: JSON.stringify({ companyName: 'Blocked' }),
			});
			expect(denied.status).toBe(403);

			const ok = await api.authFetch(FIXTURE_USERS.logan, '/api/org/settings', {
				method: 'PUT',
				body: JSON.stringify({ companyName: 'Allowed Co' }),
			});
			expect(ok.status).toBe(200);
		});
	});
});
