import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTaskTagMap } from '../server/printContexts/task.mjs';
import { renderDocumentTemplate, validatePrintTemplate } from '../server/renderDocumentTemplate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadDeliveryDocketSeed() {
	const raw = await readFile(
		path.join(root, 'document-templates/delivery_docket.json'),
		'utf8',
	);
	return validatePrintTemplate(JSON.parse(raw), 'delivery_docket');
}

describe('renderDocumentTemplate', () => {
	it('renders a minimal template to a PDF buffer', async () => {
		const template = {
			label: 'Smoke test',
			context: 'task',
			surfaces: {},
			requiresStatus: null,
			persist: false,
			page: 'letter',
			margin: 50,
			blocks: [
				{ type: 'header', title: 'Smoke test', logo: false },
				{ type: 'row', label: 'Task', value: '{{task.id}}' },
				{ type: 'multiline', value: '{{task.description}}' },
			],
		};
		const tagMap = buildTaskTagMap({
			id: 7,
			description: 'Hello PDF',
		});
		const buffer = await renderDocumentTemplate(template, {
			tagMap,
			companyName: 'Field Test Co',
			imageAttachments: [],
		});
		expect(buffer.length).toBeGreaterThan(500);
		expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
	});

	it('renders the delivery docket template', async () => {
		const template = await loadDeliveryDocketSeed();
		const tagMap = buildTaskTagMap({
			id: 42,
			createdAt: '2026-07-14T10:00:00.000Z',
			contacts: [{ name: 'Sam', isPoc: true }],
			destinationAddressName: 'City Hall',
			destinationAddress: '1 Main St',
		});
		const buffer = await renderDocumentTemplate(template, {
			tagMap,
			companyName: 'Field Test Co',
			imageAttachments: [],
		});
		expect(buffer.length).toBeGreaterThan(500);
		expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF');
	});
});
