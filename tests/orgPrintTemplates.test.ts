import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({
		query: async () => ({
			rows: [
				{ document_type: 'delivery_docket', content_hash: 'aaa' },
				{ document_type: 'invoice', content_hash: 'bbb' },
			],
		}),
	}),
}));

import {
	computeOrgPrintTemplatesRevision,
	computePrintTemplateContentHash,
	rowToPrintTemplate,
} from '../server/orgPrintTemplates.mjs';

describe('orgPrintTemplates helpers', () => {
	it('computes a stable content hash for template JSON', () => {
		const template = {
			label: 'Test',
			context: 'task',
			surfaces: { taskMenu: true },
			requiresStatus: null,
			persist: false,
			page: 'letter',
			margin: 50,
			blocks: [{ type: 'header', title: 'Test', logo: false }],
		};
		const hashA = computePrintTemplateContentHash(template);
		const hashB = computePrintTemplateContentHash({ ...template });
		expect(hashA).toBe(hashB);
		expect(hashA).toMatch(/^[a-f0-9]{64}$/);
	});

	it('changes hash when template body changes', () => {
		const base = {
			label: 'Test',
			context: 'task',
			surfaces: {},
			requiresStatus: null,
			persist: false,
			page: 'letter',
			margin: 50,
			blocks: [{ type: 'header', title: 'A', logo: false }],
		};
		const changed = {
			...base,
			blocks: [{ type: 'header', title: 'B', logo: false }],
		};
		expect(computePrintTemplateContentHash(base)).not.toBe(
			computePrintTemplateContentHash(changed),
		);
	});

	it('maps DB rows to validated templates', () => {
		const template = rowToPrintTemplate({
			document_type: 'delivery_docket',
			context: 'task',
			template: {
				label: 'Delivery Docket',
				context: 'task',
				surfaces: { taskMenu: true },
				requiresStatus: null,
				persist: true,
				page: 'letter',
				margin: 50,
				blocks: [{ type: 'header', title: 'Docket', logo: false }],
			},
			surfaces: { taskMenu: true },
			persist: true,
			requires_status: null,
		});
		expect(template.context).toBe('task');
		expect(template.persist).toBe(true);
		expect(template.surfaces.taskMenu).toBe(true);
	});

	it('computes revision hash from document type pairs', async () => {
		const revisionA = await computeOrgPrintTemplatesRevision(1);
		const revisionB = await computeOrgPrintTemplatesRevision(1);
		expect(revisionA).toBe(revisionB);
		expect(revisionA).toMatch(/^[a-f0-9]{64}$/);
	});
});
