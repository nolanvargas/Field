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
import {
	INTEGRATION_PRINT_DOCUMENT_TYPE,
	seedDeliveryDocketPrintTemplate,
} from './helpers/printTemplateFixtures.mjs';

const postgresUp = await isPostgresReachable();

describe.skipIf(!postgresUp)('task print API', () => {
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

	it('POST /api/print/delivery_docket — returns PDF and persists task_documents', async () => {
		await withCommittedDb(async (client) => {
			const { alexTaskId } = await seedIntegrationFixtures(client);
			await seedDeliveryDocketPrintTemplate(client);

			const res = await api.authFetch(
				FIXTURE_USERS.logan,
				`/api/print/${INTEGRATION_PRINT_DOCUMENT_TYPE}`,
				{
					method: 'POST',
					body: JSON.stringify({
						context: 'task',
						taskId: alexTaskId,
					}),
				},
			);
			expect(res.status).toBe(200);
			const contentType = res.headers.get('content-type') ?? '';
			expect(contentType.toLowerCase()).toContain('pdf');

			const body = Buffer.from(await res.arrayBuffer());
			expect(body.subarray(0, 5).toString('utf8')).toBe('%PDF-');

			const docs = await client.query(
				`SELECT kind, storage_key
         FROM task_documents
         WHERE task_id = $1`,
				[alexTaskId],
			);
			expect(docs.rows).toHaveLength(1);
			expect(docs.rows[0]?.kind).toBe(INTEGRATION_PRINT_DOCUMENT_TYPE);
			expect(String(docs.rows[0]?.storage_key ?? '')).toContain('.pdf');
		});
	});
});
