import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	buildTaskTagMap,
	listTaskPrintTagNames,
} from '../server/printContexts/task.mjs';
import { resolveReportPrint } from '../server/printContexts/report.mjs';
import { substituteTags, validatePrintTemplate } from '../server/renderDocumentTemplate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('print task context', () => {
	it('lists scalar tag names', () => {
		const tags = listTaskPrintTagNames();
		expect(tags).toContain('task.id');
		expect(tags).toContain('company.name');
		expect(tags).toContain('task.received_by_line');
	});

	it('substitutes tags in strings', () => {
		expect(
			substituteTags('Task {{task.id}} at {{task.destination_name}}', {
				'task.id': '42',
				'task.destination_name': 'City Hall',
			}),
		).toBe('Task 42 at City Hall');
	});

	it('validates delivery_docket seed JSON', async () => {
		const raw = await readFile(
			path.join(root, 'document-templates/delivery_docket.json'),
			'utf8',
		);
		const template = validatePrintTemplate(JSON.parse(raw), 'delivery_docket');
		expect(template.label).toBe('Delivery Docket');
		expect(template.context).toBe('task');
		expect(template.surfaces.taskMenu).toBe(true);
		expect(template.persist).toBe(true);
	});

	it('validates block types', () => {
		expect(() =>
			validatePrintTemplate({
				label: 'X',
				context: 'task',
				blocks: [],
			}),
		).toThrow(/blocks must be a non-empty array/);
		expect(() =>
			validatePrintTemplate({
				label: 'X',
				context: 'task',
				blocks: [{ type: 'nope', title: 'bad' }],
			}),
		).toThrow(/Unknown block type/);
	});

	it('builds tag map from task detail shape', () => {
		const tags = buildTaskTagMap({
			id: 42,
			externalKey: '99290',
			status: 'Completed',
			taskType: 'Delivery',
			description: '<p>Bring ladder</p>',
			jobTitle: 'Install',
			destinationAddressName: 'City Hall',
			destinationAddress: '1 Main St',
			destinationBuilding: 'Suite 2',
			destinationNotes: '',
			completedNotes: 'All good',
			completedAt: '2026-07-15T13:09:00.000Z',
			createdAt: '2026-07-14T10:00:00.000Z',
			createdByName: 'Alex',
			completionNotesByName: 'Genevieve',
			contacts: [
				{
					name: 'Sam',
					email: 'sam@example.com',
					phone: '555-0100',
					isPoc: true,
				},
			],
			crewMembers: [{ displayName: 'Jordan' }, { displayName: 'Casey' }],
			customFieldDefs: [{ slot: 1, label: 'PO Number' }],
			customFieldDisplays: { 1: 'PO-123' },
		});

		expect(tags['task.id']).toBe('42');
		expect(tags['task.external_key']).toBe('99290');
		expect(tags['task.description']).toBe('Bring ladder');
		expect(tags['task.destination_name']).toBe('City Hall');
		expect(tags['task.contact_name']).toBe('Sam');
		expect(tags['task.crew_names']).toBe('Jordan, Casey');
		expect(tags['task.custom_fields.1']).toBe('PO-123');
		expect(tags['task.custom_field.po_number']).toBe('PO-123');
		expect(tags['task.received_by_line']).toContain('Genevieve');
		expect(tags['task.destination_notes']).toBe('n/a');
	});
});

describe('print report context', () => {
	it('returns 501 for report context', () => {
		try {
			resolveReportPrint({
				reportKey: 'tasks',
				params: { from: '2026-01-01', to: '2026-01-31' },
			});
			expect.fail('expected throw');
		} catch (err) {
			expect(err).toMatchObject({ status: 501 });
		}
	});
});
