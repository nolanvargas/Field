/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const orgMocks = vi.hoisted(() => ({
	getOrgSettings: vi.fn(),
}));

vi.mock('../server/orgSettings.mjs', () => ({
	getOrgSettings: orgMocks.getOrgSettings,
}));

const CONTACT_DEFS = [
	{ slot: 1, label: 'Notes', dataType: 'text', required: true, lookupTable: null },
	{ slot: 2, label: '', dataType: 'text', required: false, lookupTable: null },
	{ slot: 3, label: 'Priority', dataType: 'number', required: false, lookupTable: null },
];

const db = {
	query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
};

describe('entityCustomFields', () => {
	beforeEach(() => {
		orgMocks.getOrgSettings.mockReset();
		orgMocks.getOrgSettings.mockResolvedValue({
			customFieldDefs: { contact: CONTACT_DEFS },
		});
		db.query.mockReset();
		db.query.mockResolvedValue({ rows: [], rowCount: 0 });
	});

	it('entityCustomFieldDefs omits unlabeled draft slots', async () => {
		const { entityCustomFieldDefs } = await import('../server/entityCustomFields.mjs');
		const defs = await entityCustomFieldDefs('contact');
		expect(defs.map((d) => d.slot)).toEqual([1, 3]);
	});

	it('parseEntityCustomFields returns undefined when customFields is omitted', async () => {
		const { parseEntityCustomFields } = await import('../server/entityCustomFields.mjs');
		const result = await parseEntityCustomFields(db, 'contact', { name: 'Jane' });
		expect(result).toBeUndefined();
	});

	it('parseEntityCustomFields validates when requireAll is set', async () => {
		const { parseEntityCustomFields } = await import('../server/entityCustomFields.mjs');
		await expect(
			parseEntityCustomFields(db, 'contact', { name: 'Jane' }, { requireAll: true }),
		).rejects.toThrow(/Notes is required/);
	});

	it('parseEntityCustomFields parses provided values', async () => {
		const { parseEntityCustomFields } = await import('../server/entityCustomFields.mjs');
		const result = await parseEntityCustomFields(db, 'contact', {
			customFields: { '1': 'VIP', '3': 2 },
		});
		expect(result).toEqual({ '1': 'VIP', '3': 2 });
	});
});
