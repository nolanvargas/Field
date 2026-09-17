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
	expireActivationCode,
	FIXTURE_USERS,
	insertActivationCode,
	revokeActivationCode,
	seedIntegrationFixtures,
} from './helpers/fixtures.mjs';

const postgresUp = await isPostgresReachable();

describe.skipIf(!postgresUp)('mobile auth API', () => {
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

	it('POST /api/mobile/activate — valid code returns session token', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
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
			expect(body.deviceSessionToken).toBeTruthy();
			expect(body.userId).toBe(FIXTURE_USERS.alex);
		});
	});

	it('POST /api/mobile/activate — reused code returns 401', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
			const { code } = await insertActivationCode(
				client,
				FIXTURE_USERS.alex,
				FIXTURE_USERS.logan,
			);

			const first = await api.fetch('/api/mobile/activate', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});
			expect(first.status).toBe(200);

			const second = await api.fetch('/api/mobile/activate', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});
			expect(second.status).toBe(401);
		});
	});

	it('POST /api/mobile/activate — expired code returns 401', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
			const { code, id } = await insertActivationCode(
				client,
				FIXTURE_USERS.alex,
				FIXTURE_USERS.logan,
			);
			await expireActivationCode(client, id);

			const res = await api.fetch('/api/mobile/activate', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});
			expect(res.status).toBe(401);
		});
	});

	it('POST /api/mobile/activate — revoked code returns 401', async () => {
		await withCommittedDb(async (client) => {
			await seedIntegrationFixtures(client);
			const { code, id } = await insertActivationCode(
				client,
				FIXTURE_USERS.alex,
				FIXTURE_USERS.logan,
			);
			await revokeActivationCode(client, id);

			const res = await api.fetch('/api/mobile/activate', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});
			expect(res.status).toBe(401);
		});
	});

	it('revoked device token — GET /api/tasks returns 401', async () => {
		await withCommittedDb(async (client) => {
			const fixtures = await seedIntegrationFixtures(client);
			const { code } = await insertActivationCode(
				client,
				FIXTURE_USERS.alex,
				FIXTURE_USERS.logan,
			);

			const activateRes = await api.fetch('/api/mobile/activate', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});
			const { deviceSessionToken, deviceId } = await activateRes.json();

			const ok = await api.deviceFetch(deviceSessionToken, '/api/tasks');
			expect(ok.status).toBe(200);

			const revokeRes = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/users/${FIXTURE_USERS.alex}/mobile-devices/${deviceId}`,
				{
					method: 'DELETE',
					body: JSON.stringify({ revokedByUserId: FIXTURE_USERS.logan }),
				},
			);
			expect(revokeRes.status).toBe(200);

			const denied = await api.deviceFetch(deviceSessionToken, '/api/tasks');
			expect(denied.status).toBe(401);

			void fixtures;
		});
	});
});
