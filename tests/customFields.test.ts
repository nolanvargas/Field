/**
 * Manual QA (not covered here):
 * 1. Management → custom field defs: all types, required toggle, lookup table, select options.
 * 2. New task / task detail modals — create, edit, clear optional fields, required validation UX.
 * 3. Lookup pickers (contacts, addresses, users, tasks) end-to-end.
 * 4. Task with frozen custom_field_defs_snapshot after org defs change — old labels/types still render.
 * 5. Mobile task view — custom field display formatting.
 */
/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	assertLookupValues,
	buildCustomFieldDefsSnapshot,
	isValidCustomFieldSlot,
	normalizeCustomFieldOptions,
	normalizeStoredCustomFields,
	parseCustomFieldDefsSnapshot,
	parseCustomFields,
	resolveCustomFieldDisplays,
	resolveCustomFieldDisplaysForMany,
} from '../server/customFields.mjs';
import {
	CUSTOM_FIELD_IMPORT_PLACEHOLDER,
	stripCustomFieldImportPlaceholders,
} from '../shared/customFieldPlaceholders.js';
import {
	CUSTOM_FIELD_UNDEFINED_DISPLAY,
	formatCustomFieldValue,
	requiredCustomFieldError,
} from '../src/customFields';

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

const FIVE_DEFS = [
	{ slot: 1, label: 'Notes', dataType: 'text', required: true, lookupTable: null },
	{ slot: 2, label: 'Count', dataType: 'number', required: false, lookupTable: null },
	{ slot: 3, label: 'Needs lift', dataType: 'boolean', required: false, lookupTable: null },
	{ slot: 4, label: 'Due', dataType: 'date', required: false, lookupTable: null },
	{
		slot: 5,
		label: 'Site contact',
		dataType: 'lookup',
		required: false,
		lookupTable: 'contacts',
	},
];

function lookupDef(
	slot: number,
	label: string,
	lookupTable: string,
): {
	slot: number;
	label: string;
	dataType: string;
	required: boolean;
	lookupTable: string;
} {
	return {
		slot,
		label,
		dataType: 'lookup',
		required: false,
		lookupTable,
	};
}

describe('isValidCustomFieldSlot', () => {
	it('accepts positive integers', () => {
		expect(isValidCustomFieldSlot(1)).toBe(true);
		expect(isValidCustomFieldSlot(99)).toBe(true);
	});

	it('rejects zero, negative, float, and non-number', () => {
		expect(isValidCustomFieldSlot(0)).toBe(false);
		expect(isValidCustomFieldSlot(-1)).toBe(false);
		expect(isValidCustomFieldSlot(1.5)).toBe(false);
		expect(isValidCustomFieldSlot('1')).toBe(false);
		expect(isValidCustomFieldSlot(null)).toBe(false);
	});
});

describe('normalizeCustomFieldOptions', () => {
	it('trims, drops blanks, and dedupes case-sensitively', () => {
		expect(
			normalizeCustomFieldOptions(['  Red  ', '', 'Red', 'blue', 'blue']),
		).toEqual(['Red', 'blue']);
	});

	it('returns empty array for non-array input', () => {
		expect(normalizeCustomFieldOptions(null as unknown as string[])).toEqual([]);
	});
});

describe('normalizeStoredCustomFields', () => {
	it('returns empty object for null, undefined, or array input', () => {
		expect(normalizeStoredCustomFields(null)).toEqual({});
		expect(normalizeStoredCustomFields(undefined)).toEqual({});
		expect(normalizeStoredCustomFields([])).toEqual({});
	});

	it('preserves null values and drops undefined', () => {
		expect(
			normalizeStoredCustomFields({ '1': 'ok', '2': null, '3': undefined }),
		).toEqual({ '1': 'ok', '2': null });
	});

	it('normalizes multiselect arrays and coerces unexpected types', () => {
		expect(
			normalizeStoredCustomFields({
				'1': ['  A ', 'A', ''],
				'2': { nested: true },
			}),
		).toEqual({ '1': ['A'], '2': '[object Object]' });
	});
});

describe('buildCustomFieldDefsSnapshot', () => {
	it('filters blank labels, sorts by slot, and normalizes options', () => {
		const snapshot = buildCustomFieldDefsSnapshot([
			{
				slot: 3,
				label: '  Tags  ',
				dataType: 'multiselect',
				required: true,
				lookupTable: null,
				options: ['  Lift ', 'Lift', ''],
			},
			{ slot: 1, label: '', dataType: 'text', required: false, lookupTable: null },
			{
				slot: 2,
				label: 'Site',
				dataType: 'lookup',
				required: false,
				lookupTable: 'addresses',
			},
		]);
		expect(snapshot).toEqual([
			{
				slot: 2,
				label: 'Site',
				dataType: 'lookup',
				required: false,
				lookupTable: 'addresses',
				options: [],
				showWhen: null,
			},
			{
				slot: 3,
				label: '  Tags  ',
				dataType: 'multiselect',
				required: true,
				lookupTable: null,
				options: ['Lift'],
				showWhen: null,
			},
		]);
	});

	it('returns empty array for non-array input', () => {
		expect(buildCustomFieldDefsSnapshot(null as unknown as never[])).toEqual([]);
	});
});

describe('parseCustomFieldDefsSnapshot', () => {
	it('returns empty array for non-array input', () => {
		expect(parseCustomFieldDefsSnapshot(null)).toEqual([]);
		expect(parseCustomFieldDefsSnapshot('bad')).toEqual([]);
	});

	it('skips junk entries and sorts by slot', () => {
		expect(
			parseCustomFieldDefsSnapshot([
				null,
				{ slot: 0, label: 'Bad slot' },
				{ slot: 2, label: 'Count', dataType: 'number' },
				{ slot: 1, label: 'Notes', dataType: 'text', required: true },
			]),
		).toEqual([
			{
				slot: 1,
				label: 'Notes',
				dataType: 'text',
				required: true,
				lookupTable: null,
				options: [],
				showWhen: null,
			},
			{
				slot: 2,
				label: 'Count',
				dataType: 'number',
				required: false,
				lookupTable: null,
				options: [],
				showWhen: null,
			},
		]);
	});

	it('round-trips with buildCustomFieldDefsSnapshot', () => {
		const built = buildCustomFieldDefsSnapshot(FIVE_DEFS);
		expect(parseCustomFieldDefsSnapshot(built)).toEqual(built);
	});
});

describe('parseCustomFields', () => {
	describe('payload shape', () => {
		it('treats null and undefined as empty object', () => {
			expect(() => parseCustomFields(null, FIVE_DEFS)).toThrow(/Notes is required/);
			expect(() => parseCustomFields(undefined, FIVE_DEFS)).toThrow(
				/Notes is required/,
			);
		});

		it('returns 400 when payload is not an object', () => {
			expect(() => parseCustomFields([], FIVE_DEFS)).toThrow(
				/customFields must be an object keyed by slot/,
			);
			expect(() => parseCustomFields('bad', FIVE_DEFS)).toThrow(
				/customFields must be an object keyed by slot/,
			);
		});
	});

	describe('def filtering', () => {
		it('skips defs with blank label or invalid slot', () => {
			const defs = [
				{ slot: 0, label: 'Zero', dataType: 'text', required: true, lookupTable: null },
				{ slot: 1, label: '', dataType: 'text', required: true, lookupTable: null },
				{
					slot: 2,
					label: 'Optional',
					dataType: 'text',
					required: false,
					lookupTable: null,
				},
			];
			expect(parseCustomFields({ '2': 'hello' }, defs)).toEqual({ '2': 'hello' });
		});

		it('skips required fields hidden by showWhen', () => {
			const defs = [
				{
					slot: 1,
					label: 'Equipment',
					dataType: 'multiselect',
					required: true,
					lookupTable: null,
					options: ['Lift'],
					showWhen: { taskTypeNames: ['Install'] },
				},
			];
			expect(parseCustomFields({}, defs, { taskTypeName: 'Delivery' })).toEqual(
				{},
			);
			expect(() =>
				parseCustomFields({}, defs, { taskTypeName: 'Install' }),
			).toThrow(/Equipment is required/);
		});

		it('ignores extra payload keys not in defs', () => {
			expect(
				parseCustomFields({ '1': 'ok', '99': 'ignored', evil: 'ignored' }, FIVE_DEFS),
			).toEqual({ '1': 'ok' });
		});

		it('reads numeric slot keys when string key is absent', () => {
			expect(parseCustomFields({ 1: 'from numeric key' }, FIVE_DEFS)).toEqual({
				'1': 'from numeric key',
			});
		});

		it('treats null defs as empty list', () => {
			expect(parseCustomFields({ '1': 'x' }, null as unknown as never[])).toEqual(
				{},
			);
		});
	});

	describe('required semantics', () => {
		it('returns 400 when a required field is missing', () => {
			expect(() => parseCustomFields({}, FIVE_DEFS)).toThrow(/Notes is required/);
			try {
				parseCustomFields({ '2': 3 }, FIVE_DEFS);
			} catch (err: unknown) {
				expect(err).toMatchObject({ status: 400 });
			}
		});

		it('returns 400 when required text is empty string', () => {
			expect(() => parseCustomFields({ '1': '' }, FIVE_DEFS)).toThrow(
				/Notes is required/,
			);
		});

		it('accepts false for required boolean', () => {
			const defs = [
				{
					slot: 1,
					label: 'Confirmed',
					dataType: 'boolean',
					required: true,
					lookupTable: null,
				},
			];
			expect(parseCustomFields({ '1': false }, defs)).toEqual({ '1': false });
		});

		it('returns 400 when required boolean is missing', () => {
			const defs = [
				{
					slot: 1,
					label: 'Confirmed',
					dataType: 'boolean',
					required: true,
					lookupTable: null,
				},
			];
			expect(() => parseCustomFields({}, defs)).toThrow(/Confirmed is required/);
		});

		it('omits optional empty values from output', () => {
			expect(parseCustomFields({ '1': 'ok', '2': '' }, FIVE_DEFS)).toEqual({
				'1': 'ok',
			});
		});
	});

	it('returns 400 when a number field has the wrong type', () => {
		expect(() =>
			parseCustomFields({ '1': 'ok', '2': 'not-a-number' }, FIVE_DEFS),
		).toThrow(/Count must be a number/);
	});

	it('accepts values for slots beyond 5', () => {
		const defs = [
			{
				slot: 6,
				label: 'Extra notes',
				dataType: 'text',
				required: false,
				lookupTable: null,
			},
		];
		expect(parseCustomFields({ '6': '  later  ' }, defs)).toEqual({
			'6': 'later',
		});
	});

	it('accepts all five types', () => {
		const parsed = parseCustomFields(
			{
				'1': '  bring extra straps ',
				'2': '3.5',
				'3': true,
				'4': '2026-09-02',
				'5': 117,
			},
			FIVE_DEFS,
		);
		expect(parsed).toEqual({
			'1': 'bring extra straps',
			'2': 3.5,
			'3': true,
			'4': '2026-09-02',
			'5': '117',
		});
	});

	describe('text', () => {
		it('accepts text up to 500 characters', () => {
			const text = 'a'.repeat(500);
			expect(parseCustomFields({ '1': text }, FIVE_DEFS)).toEqual({ '1': text });
		});

		it('returns 400 when text exceeds 500 characters', () => {
			expect(() =>
				parseCustomFields({ '1': 'a'.repeat(501) }, FIVE_DEFS),
			).toThrow(/Notes must be 500 characters or fewer/);
		});

		it('treats whitespace-only text as empty', () => {
			expect(() => parseCustomFields({ '1': '   ' }, FIVE_DEFS)).toThrow(
				/Notes is required/,
			);
		});
	});

	describe('number', () => {
		it('rejects NaN and Infinity', () => {
			expect(() =>
				parseCustomFields({ '1': 'ok', '2': NaN }, FIVE_DEFS),
			).toThrow(/Count must be a number/);
			expect(() =>
				parseCustomFields({ '1': 'ok', '2': Infinity }, FIVE_DEFS),
			).toThrow(/Count must be a number/);
		});
	});

	describe('boolean', () => {
		const defs = [
			{
				slot: 1,
				label: 'Flag',
				dataType: 'boolean',
				required: false,
				lookupTable: null,
			},
		];

		it('coerces common truthy and falsy representations', () => {
			expect(parseCustomFields({ '1': 'true' }, defs)).toEqual({ '1': true });
			expect(parseCustomFields({ '1': 'false' }, defs)).toEqual({ '1': false });
			expect(parseCustomFields({ '1': '1' }, defs)).toEqual({ '1': true });
			expect(parseCustomFields({ '1': '0' }, defs)).toEqual({ '1': false });
			expect(parseCustomFields({ '1': 1 }, defs)).toEqual({ '1': true });
			expect(parseCustomFields({ '1': 0 }, defs)).toEqual({ '1': false });
		});

		it('returns 400 for invalid boolean values', () => {
			expect(() => parseCustomFields({ '1': 'yes' }, defs)).toThrow(
				/Flag must be true or false/,
			);
			expect(() => parseCustomFields({ '1': 2 }, defs)).toThrow(
				/Flag must be true or false/,
			);
		});
	});

	describe('date', () => {
		it('returns 400 for non-ISO date formats', () => {
			expect(() =>
				parseCustomFields({ '1': 'ok', '4': '09/02/2026' }, FIVE_DEFS),
			).toThrow(/Due must be a date/);
		});

		it('rejects invalid calendar dates', () => {
			expect(() =>
				parseCustomFields({ '1': 'ok', '4': '2026-02-30' }, FIVE_DEFS),
			).toThrow(/Due must be a date/);
		});

		it('accepts leap day and truncates datetime suffix', () => {
			expect(
				parseCustomFields(
					{ '1': 'ok', '4': '2024-02-29T15:00:00.000Z' },
					FIVE_DEFS,
				),
			).toEqual({ '1': 'ok', '4': '2024-02-29' });
		});
	});

	describe('lookup', () => {
		it('returns 400 for an invalid contacts id shape', () => {
			expect(() =>
				parseCustomFields({ '1': 'ok', '5': 'abc' }, FIVE_DEFS),
			).toThrow(/Site contact must be a valid contacts id/);
		});

		it('rejects zero and negative ids for non-users lookups', () => {
			expect(() => parseCustomFields({ '1': 'ok', '5': '0' }, FIVE_DEFS)).toThrow(
				/Site contact must be a valid contacts id/,
			);
			expect(() =>
				parseCustomFields({ '1': 'ok', '5': '-1' }, FIVE_DEFS),
			).toThrow(/Site contact must be a valid contacts id/);
		});

		it('accepts users lookup as opaque string id', () => {
			const defs = [lookupDef(1, 'Assignee', 'users')];
			expect(parseCustomFields({ '1': TEST_UUID }, defs)).toEqual({
				'1': TEST_UUID,
			});
		});

		it('parses addresses lookup ids', () => {
			const defs = [lookupDef(1, 'Venue', 'addresses')];
			expect(parseCustomFields({ '1': '42' }, defs)).toEqual({ '1': '42' });
		});

		it('returns 400 when lookup table is missing or unknown', () => {
			const defs = [
				{
					slot: 1,
					label: 'Broken',
					dataType: 'lookup',
					required: false,
					lookupTable: null,
				},
			];
			expect(() => parseCustomFields({ '1': '1' }, defs)).toThrow(
				/Broken lookup table is not configured/,
			);

			const badTable = [
				{
					slot: 1,
					label: 'Broken',
					dataType: 'lookup',
					required: false,
					lookupTable: 'invoices',
				},
			];
			expect(() => parseCustomFields({ '1': '1' }, badTable)).toThrow(
				/Broken lookup table is not configured/,
			);
		});
	});

	describe('select and multiselect', () => {
		const selectDefs = [
			{
				slot: 1,
				label: 'Priority',
				dataType: 'select',
				required: false,
				lookupTable: null,
				options: ['Low', 'High'],
			},
			{
				slot: 2,
				label: 'Tags',
				dataType: 'multiselect',
				required: false,
				lookupTable: null,
				options: ['Lift', 'Ladder'],
			},
		];

		it('accepts select and multiselect values', () => {
			expect(
				parseCustomFields({ '1': 'High', '2': ['Lift', 'Ladder'] }, selectDefs),
			).toEqual({
				'1': 'High',
				'2': ['Lift', 'Ladder'],
			});
		});

		it('returns 400 for select values outside configured options', () => {
			expect(() => parseCustomFields({ '1': 'Medium' }, selectDefs)).toThrow(
				/Priority must be one of the configured options/,
			);
		});

		it('returns 400 when select or multiselect has no configured options', () => {
			const emptySelect = [
				{
					slot: 1,
					label: 'Priority',
					dataType: 'select',
					required: false,
					lookupTable: null,
					options: [],
				},
			];
			expect(() => parseCustomFields({ '1': 'Low' }, emptySelect)).toThrow(
				/Priority has no configured options/,
			);

			const emptyMulti = [
				{
					slot: 1,
					label: 'Tags',
					dataType: 'multiselect',
					required: false,
					lookupTable: null,
					options: [''],
				},
			];
			expect(() => parseCustomFields({ '1': ['Lift'] }, emptyMulti)).toThrow(
				/Tags has no configured options/,
			);
		});

		it('parses multiselect from comma-separated string with dedupe', () => {
			expect(
				parseCustomFields({ '2': 'Lift, Ladder , Lift' }, selectDefs),
			).toEqual({
				'2': ['Lift', 'Ladder'],
			});
		});

		it('returns 400 for invalid multiselect option', () => {
			expect(() =>
				parseCustomFields({ '2': ['Lift', 'Crane'] }, selectDefs),
			).toThrow(/Tags contains an invalid option/);
		});

		it('omits empty multiselect and rejects required empty multiselect', () => {
			expect(parseCustomFields({ '2': [] }, selectDefs)).toEqual({});
			const requiredMulti = [
				{
					slot: 1,
					label: 'Tags',
					dataType: 'multiselect',
					required: true,
					lookupTable: null,
					options: ['Lift'],
				},
			];
			expect(() => parseCustomFields({ '1': [] }, requiredMulti)).toThrow(
				/Tags is required/,
			);
		});
	});

	it('returns 400 for unsupported data type', () => {
		const defs = [
			{
				slot: 1,
				label: 'Weird',
				dataType: 'json',
				required: false,
				lookupTable: null,
			},
		];
		expect(() => parseCustomFields({ '1': '{}' }, defs)).toThrow(
			/Weird has an unsupported data type/,
		);
	});
});

describe('parseCustomFields tasks lookup', () => {
	const defs = [lookupDef(1, 'Related job', 'tasks')];

	it('stores the task id', () => {
		expect(parseCustomFields({ '1': 42 }, defs)).toEqual({ '1': '42' });
	});

	it('returns 400 for a non-integer id', () => {
		expect(() => parseCustomFields({ '1': 'JOB-42' }, defs)).toThrow(
			/Related job must be a valid tasks id/,
		);
	});
});

describe('assertLookupValues', () => {
	const query = vi.fn();

	beforeEach(() => {
		query.mockReset();
	});

	const db = { query };

	it('returns 400 when the lookup id does not exist', async () => {
		query.mockResolvedValue({ rowCount: 0, rows: [] });
		await expect(
			assertLookupValues(db, { '5': '999' }, FIVE_DEFS),
		).rejects.toMatchObject({
			status: 400,
			message: 'Site contact refers to an unknown contact',
		});
	});

	it('allows a lookup id that exists', async () => {
		query.mockResolvedValue({ rowCount: 1, rows: [{ id: 117 }] });
		await expect(
			assertLookupValues(db, { '5': '117' }, FIVE_DEFS),
		).resolves.toBeUndefined();
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('FROM contacts'),
			[117],
		);
	});

	it('allows a tasks lookup id that exists', async () => {
		const defs = [lookupDef(1, 'Related job', 'tasks')];
		query.mockResolvedValue({ rowCount: 1, rows: [{ id: 8 }] });
		await expect(
			assertLookupValues(db, { '1': '8' }, defs),
		).resolves.toBeUndefined();
	});

	it('returns 400 when a tasks lookup id does not exist', async () => {
		const defs = [lookupDef(1, 'Related job', 'tasks')];
		query.mockResolvedValue({ rowCount: 0, rows: [] });
		await expect(
			assertLookupValues(db, { '1': '8' }, defs),
		).rejects.toMatchObject({
			status: 400,
			message: 'Related job refers to an unknown task',
		});
	});

	it('validates users lookup with parameterized uuid query', async () => {
		const defs = [lookupDef(1, 'Assignee', 'users')];
		query.mockResolvedValue({ rowCount: 1, rows: [] });
		await expect(
			assertLookupValues(db, { '1': TEST_UUID }, defs),
		).resolves.toBeUndefined();
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('$1::uuid'),
			[TEST_UUID],
		);
	});

	it('returns 400 when users lookup id does not exist', async () => {
		const defs = [lookupDef(1, 'Assignee', 'users')];
		query.mockResolvedValue({ rowCount: 0, rows: [] });
		await expect(
			assertLookupValues(db, { '1': TEST_UUID }, defs),
		).rejects.toMatchObject({
			status: 400,
			message: 'Assignee refers to an unknown user',
		});
	});

	it('validates addresses lookup existence', async () => {
		const defs = [lookupDef(1, 'Venue', 'addresses')];
		query.mockResolvedValue({ rowCount: 1, rows: [] });
		await expect(
			assertLookupValues(db, { '1': '12' }, defs),
		).resolves.toBeUndefined();
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('FROM addresses'),
			[12],
		);
	});

	it('returns 400 when addresses lookup id does not exist', async () => {
		const defs = [lookupDef(1, 'Venue', 'addresses')];
		query.mockResolvedValue({ rowCount: 0, rows: [] });
		await expect(
			assertLookupValues(db, { '1': '12' }, defs),
		).rejects.toMatchObject({
			status: 400,
			message: 'Venue refers to an unknown address',
		});
	});

	it('skips null and empty lookup values without querying', async () => {
		await expect(assertLookupValues(db, { '5': '' }, FIVE_DEFS)).resolves.toBeUndefined();
		await expect(assertLookupValues(db, {}, FIVE_DEFS)).resolves.toBeUndefined();
		expect(query).not.toHaveBeenCalled();
	});

	it('returns 400 for malformed non-users id before querying', async () => {
		const defs = [lookupDef(1, 'Related job', 'tasks')];
		await expect(
			assertLookupValues(db, { '1': 'not-an-id' }, defs),
		).rejects.toMatchObject({
			status: 400,
			message: 'Related job must be a valid tasks id',
		});
		expect(query).not.toHaveBeenCalled();
	});

	it('returns 400 when lookup table is not configured', async () => {
		const defs = [
			{
				slot: 1,
				label: 'Broken',
				dataType: 'lookup',
				required: false,
				lookupTable: 'invoices',
			},
		];
		await expect(
			assertLookupValues(db, { '1': '1' }, defs),
		).rejects.toMatchObject({
			status: 400,
			message: 'Broken lookup table is not configured',
		});
	});
});

describe('resolveCustomFieldDisplays', () => {
	const query = vi.fn();

	beforeEach(() => {
		query.mockReset();
	});

	const db = { query };

	it('uses external_key as the display value for tasks', async () => {
		const defs = [lookupDef(1, 'Related job', 'tasks')];
		query.mockResolvedValue({
			rows: [{ id: 42, name: '99252' }],
		});
		const displays = await resolveCustomFieldDisplays(db, { '1': '42' }, defs);
		expect(displays).toEqual({ '1': '99252' });
	});

	it('resolves contacts by name', async () => {
		const defs = [lookupDef(1, 'Site contact', 'contacts')];
		query.mockResolvedValue({
			rows: [{ id: 117, name: 'Jane Doe' }],
		});
		const displays = await resolveCustomFieldDisplays(db, { '1': '117' }, defs);
		expect(displays).toEqual({ '1': 'Jane Doe' });
	});

	it('resolves addresses using address_name or street_line', async () => {
		const defs = [lookupDef(1, 'Venue', 'addresses')];
		query.mockResolvedValue({
			rows: [{ id: 5, name: 'North Warehouse' }],
		});
		const displays = await resolveCustomFieldDisplays(db, { '1': '5' }, defs);
		expect(displays).toEqual({ '1': 'North Warehouse' });
	});

	it('resolves users by display_name', async () => {
		const defs = [lookupDef(1, 'Assignee', 'users')];
		query.mockResolvedValue({
			rows: [{ id: TEST_UUID, display_name: 'Alex Crew' }],
		});
		const displays = await resolveCustomFieldDisplays(
			db,
			{ '1': TEST_UUID },
			defs,
		);
		expect(displays).toEqual({ '1': 'Alex Crew' });
	});

	it('omits display when lookup row is missing', async () => {
		const defs = [lookupDef(1, 'Site contact', 'contacts')];
		query.mockResolvedValue({ rows: [] });
		const displays = await resolveCustomFieldDisplays(db, { '1': '999' }, defs);
		expect(displays).toEqual({});
	});

	it('skips invalid numeric ids silently', async () => {
		const defs = [lookupDef(1, 'Site contact', 'contacts')];
		const displays = await resolveCustomFieldDisplays(db, { '1': 'abc' }, defs);
		expect(displays).toEqual({});
		expect(query).not.toHaveBeenCalled();
	});

	it('batches duplicate contact ids into one query', async () => {
		const defs = [
			lookupDef(1, 'Primary', 'contacts'),
			lookupDef(2, 'Secondary', 'contacts'),
		];
		query.mockResolvedValue({
			rows: [{ id: 10, name: 'Shared Contact' }],
		});
		const displays = await resolveCustomFieldDisplays(
			db,
			{ '1': '10', '2': '10' },
			defs,
		);
		expect(displays).toEqual({ '1': 'Shared Contact', '2': 'Shared Contact' });
		expect(query).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining('ANY($1::bigint[])'),
			[[10]],
		);
	});
});

describe('resolveCustomFieldDisplaysForMany', () => {
	const query = vi.fn();

	beforeEach(() => {
		query.mockReset();
	});

	const db = { query };

	it('resolves lookups per task with batched queries', async () => {
		const defs = [lookupDef(1, 'Site contact', 'contacts')];
		query.mockResolvedValue({
			rows: [
				{ id: 10, name: 'Alice' },
				{ id: 20, name: 'Bob' },
			],
		});
		const displays = await resolveCustomFieldDisplaysForMany(db, [
			{ customFields: { '1': '10' }, customFieldDefs: defs },
			{ customFields: { '1': '20' }, customFieldDefs: defs },
			{ customFields: {}, customFieldDefs: defs },
		]);
		expect(displays).toEqual([{ '1': 'Alice' }, { '1': 'Bob' }, {}]);
		expect(query).toHaveBeenCalledTimes(1);
	});
});

describe('import placeholder display', () => {
	const requiredText = {
		slot: 1,
		label: 'Region',
		dataType: 'text',
		required: true,
		lookupTable: null,
		options: [],
	};

	it('renders the sentinel as "undefined" instead of the stored token', () => {
		expect(
			formatCustomFieldValue(
				requiredText,
				CUSTOM_FIELD_IMPORT_PLACEHOLDER,
			),
		).toBe(CUSTOM_FIELD_UNDEFINED_DISPLAY);
		expect(CUSTOM_FIELD_UNDEFINED_DISPLAY).toBe('undefined');
	});

	it('ignores a lookup display name when the value is a placeholder', () => {
		expect(
			formatCustomFieldValue(
				{ ...requiredText, dataType: 'lookup', lookupTable: 'contacts' },
				CUSTOM_FIELD_IMPORT_PLACEHOLDER,
				'Alice',
			),
		).toBe(CUSTOM_FIELD_UNDEFINED_DISPLAY);
	});

	it('treats a placeholder as unfilled for required validation', () => {
		expect(
			requiredCustomFieldError(
				{ '1': CUSTOM_FIELD_IMPORT_PLACEHOLDER },
				[requiredText],
			),
		).toBe('Region is required');
		expect(requiredCustomFieldError({ '1': 'North' }, [requiredText])).toBe(
			null,
		);
		expect(
			requiredCustomFieldError(
				{},
				[
					{
						...requiredText,
						showWhen: { taskTypeNames: ['Install'] },
					},
				],
				'Delivery',
			),
		).toBe(null);
	});

	it('strips placeholder slots so callers see an empty value', () => {
		expect(
			stripCustomFieldImportPlaceholders({
				'1': CUSTOM_FIELD_IMPORT_PLACEHOLDER,
				'2': 'kept',
			}),
		).toEqual({ '2': 'kept' });
	});

	it('rejects the sentinel supplied as interactive input', () => {
		expect(() =>
			parseCustomFields({ '1': CUSTOM_FIELD_IMPORT_PLACEHOLDER }, [
				requiredText,
			]),
		).toThrow('Region is required');
	});

	it('stores the sentinel only when the import opts in', () => {
		expect(
			parseCustomFields({}, [requiredText], { placeholderForRequired: true }),
		).toEqual({ '1': CUSTOM_FIELD_IMPORT_PLACEHOLDER });
	});
});
