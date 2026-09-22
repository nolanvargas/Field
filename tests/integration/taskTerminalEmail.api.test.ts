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
} from './helpers/fixtures.mjs';

const postgresUp = await isPostgresReachable();

/**
 * @param {import('pg').Client} client
 * @param {number} taskId
 */
async function seedEmailRecipient(client, taskId) {
	const contact = await client.query(
		`INSERT INTO contacts (name, email, phone, title)
     VALUES ('UAT Contact', 'uat.contact@example.com', '5550199', 'PM')
     RETURNING id`,
	);
	const contactId = Number(contact.rows[0].id);
	await client.query(
		`INSERT INTO task_contacts (task_id, contact_id, receives_email, is_poc)
     VALUES ($1, $2, true, true)`,
		[taskId, contactId],
	);
}

describe.skipIf(!postgresUp)('terminal task email API', () => {
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

	it('PATCH status to Completed creates email_deliveries for email-enabled contact', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);
			await seedEmailRecipient(client, alexTaskId);

			const assigned = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Assigned' }),
				},
			);
			expect(assigned.status).toBe(200);

			const inProgress = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'In Progress' }),
				},
			);
			expect(inProgress.status).toBe(200);

			const completed = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({ status: 'Completed' }),
				},
			);
			expect(completed.status).toBe(200);

			const deliveries = await client.query(
				`SELECT status::text AS status, trigger, to_addresses
         FROM email_deliveries
         WHERE task_id = $1`,
				[alexTaskId],
			);
			expect(deliveries.rows.length).toBeGreaterThan(0);
			expect(deliveries.rows[0]?.trigger).toBe('task_completed');
			expect(deliveries.rows[0]?.to_addresses).toContain(
				'uat.contact@example.com',
			);
			expect(['sent', 'failed', 'pending']).toContain(
				deliveries.rows[0]?.status,
			);
		});
	});

	it('PATCH status to Failed creates task_failed email_deliveries', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);
			await seedEmailRecipient(client, alexTaskId);

			for (const status of ['Assigned', 'In Progress'] as const) {
				const res = await api.authFetch(
					FIXTURE_USERS.logan,
					`/api/tasks/${alexTaskId}/status`,
					{
						method: 'PATCH',
						body: JSON.stringify({ status }),
					},
				);
				expect(res.status).toBe(200);
			}

			const failed = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/tasks/${alexTaskId}/status`,
				{
					method: 'PATCH',
					body: JSON.stringify({
						status: 'Failed',
						notes: 'Could not access site',
					}),
				},
			);
			expect(failed.status).toBe(200);

			const deliveries = await client.query(
				`SELECT trigger, to_addresses
         FROM email_deliveries
         WHERE task_id = $1 AND trigger = 'task_failed'`,
				[alexTaskId],
			);
			expect(deliveries.rows.length).toBeGreaterThan(0);
			expect(deliveries.rows[0]?.to_addresses).toContain(
				'uat.contact@example.com',
			);
		});
	});
});
