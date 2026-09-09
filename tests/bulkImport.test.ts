/**
 * Manual QA (not covered here):
 * 1. Management → Import/export UI: upload CSV, preview table, per-field conflict picker, apply toasts.
 * 2. Browser-only manage_org gate on /api/import/* routes.
 * 3. Excel / Google Sheets download → edit → re-upload round-trip.
 * 4. Live 5 MB upload rejection in the browser (unit tests cover readMultipartCsv limit).
 */
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
	parseCsv,
	serializeCsv,
	serializeCsvWithBom,
	stripUtf8Bom,
} from '../shared/csv.js';
import {
	importHeaders,
	normalizeImportHeader,
} from '../shared/importColumns.js';
import { CUSTOM_FIELD_IMPORT_PLACEHOLDER } from '../shared/customFieldPlaceholders.js';
import {
	customFieldsFromCells,
	normalizeCustomFieldCells,
	storedCustomFieldCells,
} from '../server/bulkImport/customFields.mjs';
import {
	formatBooleanCell,
	parseBooleanCell,
} from '../server/bulkImport/boolean.mjs';
import {
	normalizeMatchKey,
	parseImportCsv,
} from '../server/bulkImport/parse.mjs';
import {
	buildImportCsv,
	buildImportCsvRows,
} from '../server/bulkImport/rows.mjs';
import {
	applyContactsImport,
	previewContactsImport,
} from '../server/bulkImport/contacts.mjs';
import {
	applyAddressesImport,
	previewAddressesImport,
} from '../server/bulkImport/addresses.mjs';
import {
	applyUsersImport,
	previewUsersImport,
} from '../server/bulkImport/users.mjs';
import {
	applyImport,
	isImportEntity,
	parseImportMode,
	previewImport,
} from '../server/bulkImport/index.mjs';
import { readMultipartCsv } from '../server/bulkImport/multipart.mjs';
import { PERMISSIONS } from '../shared/permissions.js';

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const dbMocks = vi.hoisted(() => ({
	query: vi.fn(),
}));

vi.mock('../server/db.mjs', () => ({
	getPool: () => ({
		query: dbMocks.query,
	}),
}));

/**
 * Org custom field defs come from `getOrgSettings`, which would consume the
 * queued `dbMocks.query` results. Stub the seam instead and set
 * `customFieldMocks.defs` in the tests that exercise custom field columns.
 */
const customFieldMocks = vi.hoisted(() => ({
	defs: [] as { slot: number; label: string; dataType: string; required: boolean }[],
}));

vi.mock('../server/entityCustomFields.mjs', () => ({
	entityCustomFieldDefs: async () => customFieldMocks.defs,
}));

function buildMultipartBody(
	fields: { name: string; filename?: string; content: string | Buffer }[],
	boundary = '----vitest-boundary',
): Buffer {
	const chunks: Buffer[] = [];
	for (const field of fields) {
		let part = `--${boundary}\r\n`;
		if (field.filename !== undefined) {
			part += `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`;
			part += 'Content-Type: application/octet-stream\r\n\r\n';
		} else {
			part += `Content-Disposition: form-data; name="${field.name}"\r\n\r\n`;
		}
		chunks.push(Buffer.from(part));
		chunks.push(
			Buffer.isBuffer(field.content)
				? field.content
				: Buffer.from(field.content),
		);
		chunks.push(Buffer.from('\r\n'));
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`));
	return Buffer.concat(chunks);
}

beforeEach(() => {
	customFieldMocks.defs = [];
});

function mockMultipartRequest(
	body: Buffer,
	boundary = '----vitest-boundary',
	contentType?: string,
): IncomingMessage {
	const req = Readable.from([body]) as IncomingMessage & {
		headers: Record<string, string>;
	};
	req.headers = {
		'content-type':
			contentType ?? `multipart/form-data; boundary=${boundary}`,
	};
	return req;
}

describe('shared/csv', () => {
	it('round-trips quoted fields with commas and newlines', () => {
		const rows = [
			['Name', 'Notes'],
			['Acme, Inc.', 'Line one\nLine two'],
			['Say "hi"', ''],
		];
		const text = serializeCsv(rows);
		expect(parseCsv(text)).toEqual(rows);
	});

	it('serializeCsvWithBom prefixes UTF-8 BOM', () => {
		const out = serializeCsvWithBom([['a']]);
		expect(out.charCodeAt(0)).toBe(0xfeff);
		expect(stripUtf8Bom(out)).toBe('a');
	});

	it('parses CRLF line endings', () => {
		const text = 'a,b\r\nc,d';
		expect(parseCsv(text)).toEqual([['a', 'b'], ['c', 'd']]);
	});

	it('treats nullish cells as empty strings on serialize', () => {
		const text = serializeCsv([[null as unknown as string, undefined as unknown as string]]);
		expect(parseCsv(text)).toEqual([['', '']]);
	});

	it('handles trailing newline without extra empty row', () => {
		expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
	});
});

describe('boolean cells', () => {
	it('parses TRUE/FALSE and common aliases (case-insensitive); empty as FALSE', () => {
		expect(parseBooleanCell('TRUE')).toBe(true);
		expect(parseBooleanCell('false')).toBe(false);
		expect(parseBooleanCell('t')).toBe(true);
		expect(parseBooleanCell('F')).toBe(false);
		expect(parseBooleanCell('y')).toBe(true);
		expect(parseBooleanCell('N')).toBe(false);
		expect(parseBooleanCell('yes')).toBe(true);
		expect(parseBooleanCell('NO')).toBe(false);
		expect(parseBooleanCell('')).toBe(false);
		expect(formatBooleanCell(true)).toBe('TRUE');
		expect(formatBooleanCell(false)).toBe('FALSE');
	});

	it('treats null and undefined as FALSE', () => {
		expect(parseBooleanCell(null)).toBe(false);
		expect(parseBooleanCell(undefined)).toBe(false);
	});

	it('rejects invalid boolean literals', () => {
		expect(() => parseBooleanCell('maybe')).toThrow(/TRUE\/FALSE/);
		expect(() => parseBooleanCell('1')).toThrow(/TRUE\/FALSE/);
		expect(() => parseBooleanCell('0')).toThrow(/TRUE\/FALSE/);
	});
});

describe('normalizeMatchKey', () => {
	it('folds case and collapses whitespace', () => {
		expect(normalizeMatchKey('  Alex   Rivera  ')).toBe('alex rivera');
		expect(normalizeMatchKey('JANE@EXAMPLE.COM')).toBe('jane@example.com');
	});

	it('returns empty string for blank input', () => {
		expect(normalizeMatchKey('')).toBe('');
		expect(normalizeMatchKey('   ')).toBe('');
	});
});

describe('parseImportCsv', () => {
	it('throws 400 for empty CSV', () => {
		try {
			parseImportCsv('contacts', '');
			expect.unreachable('should throw');
		} catch (err) {
			expect(err).toMatchObject({
				message: 'CSV file is empty',
				status: 400,
			});
		}
	});

	it('throws 400 for unknown column headers', () => {
		const csv = 'Name,Unknown\nAlex,';
		try {
			parseImportCsv('contacts', csv);
			expect.unreachable('should throw');
		} catch (err) {
			expect(err).toMatchObject({
				message: 'Unknown column(s): Unknown',
				status: 400,
			});
		}
	});

	it('throws 400 when required column is missing', () => {
		const csv = 'Email,Title\na@example.com,';
		try {
			parseImportCsv('contacts', csv);
			expect.unreachable('should throw');
		} catch (err) {
			expect(err).toMatchObject({
				message: 'Missing required column: Name',
				status: 400,
			});
		}
	});

	it('skips blank data rows and preserves rowIndex', () => {
		const header = importHeaders('contacts', 'template').join(',');
		const csv = `${header}\n  ,  ,  ,  \nAlex,,,`;
		const { rows } = parseImportCsv('contacts', csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].rowIndex).toBe(3);
		expect(rows[0].fields.name).toBe('Alex');
	});

	it('accepts header aliases for users and addresses', () => {
		const usersCsv =
			'Name,Email\nJane Doe,jane@example.com';
		const { rows: userRows } = parseImportCsv('users', usersCsv);
		expect(userRows[0].fields.displayName).toBe('Jane Doe');

		const addrCsv =
			'Name,Zip,Street\nWarehouse,62701,100 Main St';
		const { rows: addrRows } = parseImportCsv('addresses', addrCsv);
		expect(addrRows[0].fields.addressName).toBe('Warehouse');
		expect(addrRows[0].fields.postalCode).toBe('62701');
	});

	it('accepts optional Id header alias', () => {
		const csv =
			'Id (optional — leave blank for new),Name\n,Alex';
		const { rows } = parseImportCsv('contacts', csv);
		expect(rows[0].fields.id).toBe('');
		expect(rows[0].fields.name).toBe('Alex');
	});

	it('strips UTF-8 BOM from header row', () => {
		const header = importHeaders('contacts', 'template').join(',');
		const csv = `\uFEFF${header}\nAlex,,,`;
		const { rows } = parseImportCsv('contacts', csv);
		expect(rows[0].fields.name).toBe('Alex');
	});
});

describe('parseImportCsv — users permissions', () => {
	const header = importHeaders('users', 'template').join(',');

	it('normalizes permission columns to TRUE/FALSE', () => {
		const csv = `${header}\nJane Doe,jane@example.com,,Crew,TRUE,FALSE,TRUE`;
		const { rows } = parseImportCsv('users', csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].fields.manageUsers).toBe('TRUE');
		expect(rows[0].fields.manageOrg).toBe('FALSE');
		expect(rows[0].fields.viewCrewMap).toBe('TRUE');
	});

	it('treats empty permission cells as FALSE', () => {
		const csv = `${header}\nBob,bob@example.com,,,,,`;
		const { rows } = parseImportCsv('users', csv);
		expect(rows[0].fields.manageUsers).toBe('FALSE');
		expect(rows[0].fields.manageOrg).toBe('FALSE');
		expect(rows[0].fields.viewCrewMap).toBe('FALSE');
	});

	it('surfaces invalid permission cells as row errors', () => {
		const csv = `${header}\nBob,bob@example.com,,,maybe,,`;
		const { rows } = parseImportCsv('users', csv);
		expect(rows[0].errors.some((e) => e.includes('Manage users'))).toBe(
			true,
		);
		expect(rows[0].errors.some((e) => e.includes('TRUE/FALSE'))).toBe(true);
	});
});

describe('buildImportCsvRows', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('blank template is header only', async () => {
		const rows = await buildImportCsvRows('contacts', 'blank');
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual(importHeaders('contacts', 'template'));
	});

	it('sample template has header + 10 rows', async () => {
		const rows = await buildImportCsvRows('users', 'sample');
		expect(rows).toHaveLength(11);
		expect(rows[0]).toEqual(importHeaders('users', 'template'));
		const permCols = [4, 5, 6];
		for (let i = 1; i <= 10; i++) {
			for (const col of permCols) {
				expect(['TRUE', 'FALSE']).toContain(rows[i][col]);
			}
		}
	});

	it('addresses sample template has header + 10 rows', async () => {
		const rows = await buildImportCsvRows('addresses', 'sample');
		expect(rows).toHaveLength(11);
		expect(rows[0]).toEqual(importHeaders('addresses', 'template'));
	});

	it('current export includes header + db count', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 1,
					name: 'Alex',
					title: '',
					phone: '',
					email: 'alex@example.com',
				},
				{
					id: 2,
					name: 'Jordan',
					title: 'Lead',
					phone: '555',
					email: '',
				},
			],
		});
		const rows = await buildImportCsvRows('contacts', 'current');
		expect(rows).toHaveLength(3);
		expect(rows[0]).toEqual(importHeaders('contacts', 'export'));
		expect(rows[1][0]).toBe('1');
		expect(rows[1][1]).toBe('Alex');
	});

	it('addresses current export maps db fields to columns', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 5,
					address_name: 'North Warehouse',
					street_line: '100 Industrial Blvd',
					building: 'Bay 3',
					notes: 'Gate code 1234',
				},
			],
		});
		const rows = await buildImportCsvRows('addresses', 'current');
		expect(rows).toHaveLength(2);
		expect(rows[1][0]).toBe('5');
		expect(rows[1][1]).toBe('North Warehouse');
		expect(rows[1][2]).toBe('100 Industrial Blvd');
	});

	it('users current export formats permission columns', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: TEST_UUID,
					display_name: 'Admin',
					email: 'admin@example.com',
					phone: '',
					role: 'Admin',
					permissions: [PERMISSIONS.manageUsers, PERMISSIONS.manageOrg],
				},
			],
		});
		const rows = await buildImportCsvRows('users', 'current');
		expect(rows).toHaveLength(2);
		expect(rows[1][0]).toBe(TEST_UUID);
		expect(rows[1][4]).toBe('Admin');
		expect(rows[1][5]).toBe('TRUE');
		expect(rows[1][6]).toBe('TRUE');
		expect(rows[1][7]).toBe('FALSE');
	});
});

describe('buildImportCsv', () => {
	it('returns BOM-prefixed CSV string', async () => {
		const csv = await buildImportCsv('contacts', 'blank');
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(csv).toContain('Name');
	});
});

describe('bulkImport index helpers', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('isImportEntity rejects unknown entities', () => {
		expect(isImportEntity('contacts')).toBe(true);
		expect(isImportEntity('tasks')).toBe(false);
	});

	it('parseImportMode defaults invalid values to blank', () => {
		expect(parseImportMode('sample')).toBe('sample');
		expect(parseImportMode('current')).toBe('current');
		expect(parseImportMode('bogus')).toBe('blank');
	});

	it('previewImport routes to entity preview handlers', async () => {
		dbMocks.query.mockResolvedValue({ rows: [] });
		const contactsHeader = importHeaders('contacts', 'template').join(',');
		const contacts = await previewImport(
			'contacts',
			`${contactsHeader}\nNew Person,,,`,
		);
		expect(contacts.summary.new).toBe(1);

		const addrHeader = importHeaders('addresses', 'template').join(',');
		const addresses = await previewImport(
			'addresses',
			`${addrHeader}\nSite,100 Main St,,,,`,
		);
		expect(addresses.summary.new).toBe(1);

		const usersHeader = importHeaders('users', 'template').join(',');
		const users = await previewImport(
			'users',
			`${usersHeader}\nNew User,new@example.com,,,,,`,
		);
		expect(users.summary.new).toBe(1);
	});

	it('applyImport routes contacts apply without actor checks', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyImport(
			'contacts',
			[
				{
					rowIndex: 2,
					status: 'new',
					imported: {
						name: 'New',
						title: '',
						phone: '',
						email: '',
					},
				},
			],
			'actor-1',
		);
		expect(result.created).toBe(1);
	});
});

describe('previewContactsImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('detects conflict when blank id matches existing name with different data', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 42,
					name: 'Alex Rivera',
					title: 'Old title',
					phone: '',
					email: 'alex@example.com',
				},
			],
		});

		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: '',
					name: 'Alex Rivera',
					title: 'New title',
					phone: '',
					email: 'alex@example.com',
				},
				errors: [],
			},
		]);

		expect(result.summary.conflict).toBe(1);
		expect(result.rows[0].status).toBe('conflict');
		expect(result.rows[0].matchId).toBe('42');
	});

	it('marks row as new when no id and no name match', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: '',
					name: 'Nobody Here',
					title: '',
					phone: '',
					email: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.new).toBe(1);
	});

	it('matches names case-insensitively but flags conflict when field values differ', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 7,
					name: 'Alex Rivera',
					title: 'Lead',
					phone: '',
					email: 'alex@example.com',
				},
			],
		});
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: '',
					name: 'ALEX RIVERA',
					title: 'Lead',
					phone: '',
					email: 'alex@example.com',
				},
				errors: [],
			},
		]);
		expect(result.summary.conflict).toBe(1);
		expect(result.rows[0].status).toBe('conflict');
		expect(result.rows[0].matchId).toBe('7');
	});

	it('updates by numeric id when id is present', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 99,
					name: 'Existing',
					title: '',
					phone: '',
					email: '',
				},
			],
		});
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: '99',
					name: 'Updated Name',
					title: '',
					phone: '',
					email: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.update).toBe(1);
		expect(result.rows[0].matchId).toBe('99');
	});

	it('errors on non-numeric id', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: 'abc',
					name: 'Test',
					title: '',
					phone: '',
					email: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors).toContain(
			'Id must be a numeric contact id',
		);
	});

	it('errors when id is not found', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: {
					id: '404',
					name: 'Ghost',
					title: '',
					phone: '',
					email: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors?.[0]).toMatch(/404 not found/);
	});

	it('passes through parse errors without matching', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewContactsImport([
			{
				rowIndex: 2,
				fields: { id: '', name: '', title: '', phone: '', email: '' },
				errors: ['Name is required'],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].status).toBe('error');
	});
});

describe('previewAddressesImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('combines spreadsheet columns into street_line for new rows', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewAddressesImport([
			{
				rowIndex: 2,
				fields: {
					addressName: 'North Warehouse',
					street: '100 Industrial Blvd',
					city: 'Springfield',
					state: 'IL',
					postalCode: '62701',
					building: 'Bay 3',
					notes: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.new).toBe(1);
		expect(result.rows[0].imported.street).toBe('100 Industrial Blvd');
	});

	it('requires Street at CSV parse time', () => {
		const header = importHeaders('addresses', 'template').join(',');
		const csv = `${header}\nNowhere,,Springfield,IL,62701,,`;
		const { rows } = parseImportCsv('addresses', csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].errors).toContain('Street is required');
	});

	it('accepts city/state/postal without street column value at preview', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewAddressesImport([
			{
				rowIndex: 2,
				fields: {
					addressName: 'City Only',
					street: '',
					city: 'Springfield',
					state: 'IL',
					postalCode: '62701',
					building: '',
					notes: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.new).toBe(1);
	});

	it('errors when combined street exceeds 500 characters', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const longStreet = 'A'.repeat(501);
		const result = await previewAddressesImport([
			{
				rowIndex: 2,
				fields: {
					addressName: 'Long',
					street: longStreet,
					city: '',
					state: '',
					postalCode: '',
					building: '',
					notes: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors?.[0]).toMatch(/500 characters/);
	});

	it('detects conflict when address name matches with different street', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 10,
					address_name: 'Warehouse',
					street_line: '100 Old St',
					building: '',
					notes: '',
				},
			],
		});
		const result = await previewAddressesImport([
			{
				rowIndex: 2,
				fields: {
					addressName: 'Warehouse',
					street: '200 New St',
					city: '',
					state: '',
					postalCode: '',
					building: '',
					notes: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.conflict).toBe(1);
	});

	it('updates by numeric id', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 3,
					address_name: 'Site',
					street_line: '100 Main',
					building: '',
					notes: '',
				},
			],
		});
		const result = await previewAddressesImport([
			{
				rowIndex: 2,
				fields: {
					id: '3',
					addressName: 'Site',
					street: '100 Main',
					city: '',
					state: '',
					postalCode: '',
					building: '',
					notes: '',
				},
				errors: [],
			},
		]);
		expect(result.summary.update).toBe(1);
	});
});

describe('previewUsersImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('marks valid new user row as new', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: 'New User',
					email: 'new@example.com',
					phone: '',
					role: 'Crew',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.new).toBe(1);
	});

	it('errors on missing name', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: '',
					email: 'a@example.com',
					phone: '',
					role: '',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors).toContain('Name is required');
	});

	it('errors on invalid email', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: 'Bad Email',
					email: 'not-an-email',
					phone: '',
					role: '',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors).toContain('Email is invalid');
	});

	it('errors on field length limits', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: 'A'.repeat(256),
					email: '',
					phone: '1'.repeat(51),
					role: 'R'.repeat(51),
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors).toContain(
			'Name must be 255 characters or fewer',
		);
		expect(result.rows[0].errors).toContain(
			'Phone must be 50 characters or fewer',
		);
	});

	it('errors on non-UUID id', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					id: 'not-a-uuid',
					displayName: 'Test',
					email: '',
					phone: '',
					role: '',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors).toContain('Id must be a valid user UUID');
	});

	it('errors when UUID id is not found', async () => {
		dbMocks.query.mockResolvedValueOnce({ rows: [] });
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					id: TEST_UUID,
					displayName: 'Ghost',
					email: '',
					phone: '',
					role: '',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.error).toBe(1);
		expect(result.rows[0].errors?.[0]).toMatch(/not found/);
	});

	it('detects email conflict case-insensitively', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: TEST_UUID,
					display_name: 'Jane',
					email: 'jane@example.com',
					phone: '',
					role: 'Crew',
					permissions: [],
				},
			],
		});
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: 'Jane Doe',
					email: 'JANE@EXAMPLE.COM',
					phone: '',
					role: 'Crew',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.conflict).toBe(1);
	});

	it('updates when email matches and fields are identical', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: TEST_UUID,
					display_name: 'Jane',
					email: 'jane@example.com',
					phone: '',
					role: 'Crew',
					permissions: [],
				},
			],
		});
		const result = await previewUsersImport([
			{
				rowIndex: 2,
				fields: {
					displayName: 'Jane',
					email: 'jane@example.com',
					phone: '',
					role: 'Crew',
					manageUsers: 'FALSE',
					manageOrg: 'FALSE',
					viewCrewMap: 'FALSE',
				},
				errors: [],
			},
		]);
		expect(result.summary.update).toBe(1);
	});
});

describe('applyContactsImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('inserts new rows', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyContactsImport([
			{
				rowIndex: 2,
				status: 'new',
				imported: {
					name: 'New Contact',
					title: '',
					phone: '',
					email: '',
				},
			},
		]);
		expect(result.created).toBe(1);
		expect(dbMocks.query).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO contacts'),
			expect.arrayContaining(['New Contact']),
		);
	});

	it('updates existing rows by matchId', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyContactsImport([
			{
				rowIndex: 2,
				status: 'update',
				matchId: '42',
				imported: {
					name: 'Updated',
					title: '',
					phone: '',
					email: '',
				},
			},
		]);
		expect(result.updated).toBe(1);
	});

	it('reports error when update affects zero rows', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 0 });
		const result = await applyContactsImport([
			{
				rowIndex: 2,
				status: 'update',
				matchId: '99',
				imported: {
					name: 'Missing',
					title: '',
					phone: '',
					email: '',
				},
			},
		]);
		expect(result.errors[0]).toMatch(/contact not found/);
	});

	it('skips error-status rows', async () => {
		const result = await applyContactsImport([
			{
				rowIndex: 2,
				status: 'error',
				imported: {
					name: 'Bad',
					title: '',
					phone: '',
					email: '',
				},
			},
		]);
		expect(result.created).toBe(0);
		expect(dbMocks.query).not.toHaveBeenCalled();
	});

	it('merges conflict resolution keeping existing field values', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		await applyContactsImport([
			{
				rowIndex: 2,
				status: 'conflict',
				matchId: '42',
				imported: {
					name: 'Imported Name',
					title: 'Imported Title',
					phone: '',
					email: '',
				},
				existing: {
					name: 'Existing Name',
					title: 'Existing Title',
					phone: '555',
					email: 'keep@example.com',
				},
				resolution: { title: 'existing', email: 'existing' },
			},
		]);
		expect(dbMocks.query).toHaveBeenCalledWith(
			expect.any(String),
			[42, 'Imported Name', 'Existing Title', null, 'keep@example.com', '{}'],
		);
	});

	it('truncates long name on insert', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const longName = 'N'.repeat(300);
		await applyContactsImport([
			{
				rowIndex: 2,
				status: 'new',
				imported: {
					name: longName,
					title: '',
					phone: '',
					email: '',
				},
			},
		]);
		const params = dbMocks.query.mock.calls[0][1] as string[];
		expect(params[0].length).toBe(255);
	});
});

describe('applyAddressesImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('inserts new address rows', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyAddressesImport([
			{
				rowIndex: 2,
				status: 'new',
				imported: {
					addressName: 'Site',
					street: '100 Main St',
					city: '',
					state: '',
					postalCode: '',
					building: '',
					notes: '',
				},
			},
		]);
		expect(result.created).toBe(1);
	});

	it('rejects combined street over 500 chars without querying', async () => {
		const result = await applyAddressesImport([
			{
				rowIndex: 2,
				status: 'new',
				imported: {
					addressName: 'Long',
					street: 'A'.repeat(501),
					city: '',
					state: '',
					postalCode: '',
					building: '',
					notes: '',
				},
			},
		]);
		expect(result.errors[0]).toMatch(/500 characters/);
		expect(dbMocks.query).not.toHaveBeenCalled();
	});

	it('merges conflict resolution for building field', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		await applyAddressesImport([
			{
				rowIndex: 2,
				status: 'conflict',
				matchId: '5',
				imported: {
					addressName: 'Site',
					street: '100 Main',
					city: '',
					state: '',
					postalCode: '',
					building: 'New Bay',
					notes: 'New notes',
				},
				existing: {
					addressName: 'Site',
					street: '100 Main',
					city: '',
					state: '',
					postalCode: '',
					building: 'Old Bay',
					notes: 'Old notes',
				},
				resolution: { building: 'existing' },
			},
		]);
		const params = dbMocks.query.mock.calls[0][1] as unknown[];
		expect(params[3]).toBe('Old Bay');
		expect(params[4]).toBe('New notes');
	});
});

describe('applyUsersImport', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('inserts new users', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'new',
					imported: {
						displayName: 'New User',
						email: 'new@example.com',
						phone: '',
						role: 'Crew',
						manageUsers: 'FALSE',
						manageOrg: 'FALSE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-1',
		);
		expect(result.created).toBe(1);
		expect(dbMocks.query).toHaveBeenCalledWith(
			expect.stringContaining('INSERT INTO users'),
			expect.any(Array),
		);
	});

	it('blocks actor from removing own manage_users', async () => {
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'update',
					matchId: 'actor-1',
					imported: {
						displayName: 'Self',
						email: 'self@example.com',
						phone: '',
						role: 'Admin',
						manageUsers: 'FALSE',
						manageOrg: 'TRUE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-1',
		);
		expect(result.errors[0]).toMatch(/Cannot remove manage_users from yourself/);
		expect(dbMocks.query).not.toHaveBeenCalled();
	});

	it('blocks removing last manage_users holder', async () => {
		dbMocks.query
			.mockResolvedValueOnce({
				rows: [{ permissions: [PERMISSIONS.manageUsers] }],
			})
			.mockResolvedValueOnce({ rows: [] });
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'update',
					matchId: TEST_UUID,
					imported: {
						displayName: 'Last Admin',
						email: 'admin@example.com',
						phone: '',
						role: 'Admin',
						manageUsers: 'FALSE',
						manageOrg: 'FALSE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-2',
		);
		expect(result.errors[0]).toMatch(/only user with Manage users/);
	});

	it('maps duplicate email db error to friendly message', async () => {
		const dupErr = Object.assign(new Error('duplicate key'), { code: '23505' });
		dbMocks.query.mockRejectedValueOnce(dupErr);
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'new',
					imported: {
						displayName: 'Dup',
						email: 'dup@example.com',
						phone: '',
						role: '',
						manageUsers: 'FALSE',
						manageOrg: 'FALSE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-1',
		);
		expect(result.errors[0]).toMatch(/email already exists/);
	});

	it('rejects long displayName at apply time', async () => {
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'new',
					imported: {
						displayName: 'D'.repeat(300),
						email: '',
						phone: '',
						role: '',
						manageUsers: 'FALSE',
						manageOrg: 'FALSE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-1',
		);
		expect(result.errors[0]).toMatch(/255 characters/);
		expect(dbMocks.query).not.toHaveBeenCalled();
	});

	it('updates user when permissions change is allowed', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		const result = await applyUsersImport(
			[
				{
					rowIndex: 2,
					status: 'update',
					matchId: TEST_UUID_2,
					imported: {
						displayName: 'Other',
						email: 'other@example.com',
						phone: '',
						role: 'Crew',
						manageUsers: 'TRUE',
						manageOrg: 'FALSE',
						viewCrewMap: 'FALSE',
					},
				},
			],
			'actor-1',
		);
		expect(result.updated).toBe(1);
	});
});

describe('readMultipartCsv', () => {
	it('rejects non-multipart Content-Type', async () => {
		const body = buildMultipartBody([
			{ name: 'file', filename: 'test.csv', content: 'a,b' },
		]);
		const req = mockMultipartRequest(body, '----vitest-boundary', 'text/plain');
		await expect(readMultipartCsv(req)).rejects.toMatchObject({
			message: 'Content-Type must be multipart/form-data',
			status: 400,
		});
	});

	it('rejects when file field is missing', async () => {
		const body = buildMultipartBody([
			{ name: 'other', content: 'ignored' },
		]);
		const req = mockMultipartRequest(body);
		await expect(readMultipartCsv(req)).rejects.toMatchObject({
			message: 'file field is required',
			status: 400,
		});
	});

	it('rejects non-csv file extension', async () => {
		const body = buildMultipartBody([
			{ name: 'file', filename: 'data.txt', content: 'a,b' },
		]);
		const req = mockMultipartRequest(body);
		await expect(readMultipartCsv(req)).rejects.toMatchObject({
			message: 'Only .csv files are accepted',
			status: 400,
		});
	});

	it('returns buffer for valid csv upload', async () => {
		const payload = 'Name,Email\nJane,jane@example.com';
		const body = buildMultipartBody([
			{ name: 'file', filename: 'import.csv', content: payload },
		]);
		const req = mockMultipartRequest(body);
		const buf = await readMultipartCsv(req);
		expect(buf.toString('utf8')).toBe(payload);
	});

	it('rejects files over 5 MB', async () => {
		const big = Buffer.alloc(5 * 1024 * 1024 + 1, 'x');
		const body = buildMultipartBody([
			{ name: 'file', filename: 'big.csv', content: big },
		]);
		const req = mockMultipartRequest(body);
		await expect(readMultipartCsv(req)).rejects.toMatchObject({
			message: 'CSV file exceeds 5 MB limit',
			status: 400,
		});
	});
});

describe('assertPermission for import routes', () => {
	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('returns 403 when actor lacks manage_org', async () => {
		const { assertPermission } = await import('../server/permissions.mjs');
		dbMocks.query.mockResolvedValueOnce({
			rows: [{ permissions: [PERMISSIONS.manageUsers] }],
		});
		await expect(
			assertPermission('user-1', PERMISSIONS.manageOrg),
		).rejects.toMatchObject({ status: 403 });
	});
});

describe('custom field import columns', () => {
	const textDef = {
		slot: 1,
		label: 'Region',
		dataType: 'text',
		required: false,
		lookupTable: null,
	};
	const requiredSelectDef = {
		slot: 2,
		label: 'Tier',
		dataType: 'select',
		required: true,
		lookupTable: null,
		options: ['Gold', 'Silver'],
	};
	const boolDef = {
		slot: 3,
		label: 'On call',
		dataType: 'boolean',
		required: false,
		lookupTable: null,
	};

	beforeEach(() => {
		dbMocks.query.mockReset();
	});

	it('appends labeled defs to headers in slot order and skips drafts', () => {
		expect(
			importHeaders('contacts', 'template', [
				boolDef,
				{ ...textDef, slot: 9, label: '  ' },
				requiredSelectDef,
			]),
		).toEqual([
			...importHeaders('contacts', 'template'),
			'Tier',
			'On call',
		]);
	});

	it('normalizes a custom field label to its slot key', () => {
		expect(normalizeImportHeader('contacts', 'Region', [textDef])).toBe(
			'cf:1',
		);
		expect(normalizeImportHeader('contacts', ' region ', [textDef])).toBe(
			'cf:1',
		);
	});

	it('keeps builtin columns when a custom field label collides', () => {
		expect(
			normalizeImportHeader('contacts', 'Email', [
				{ ...textDef, label: 'Email' },
			]),
		).toBe('email');
	});

	it('stores the placeholder sentinel for a blank required cell', () => {
		expect(
			customFieldsFromCells({ 'cf:1': 'North' }, [
				textDef,
				requiredSelectDef,
			]),
		).toEqual({
			'1': 'North',
			'2': CUSTOM_FIELD_IMPORT_PLACEHOLDER,
		});
	});

	it('accepts spreadsheet boolean vocabulary and rejects other text', () => {
		expect(customFieldsFromCells({ 'cf:3': 'Y' }, [boolDef])).toEqual({
			'3': true,
		});
		expect(customFieldsFromCells({ 'cf:3': 'FALSE' }, [boolDef])).toEqual({
			'3': false,
		});
		expect(() => customFieldsFromCells({ 'cf:3': 'maybe' }, [boolDef])).toThrow(
			/TRUE\/FALSE/,
		);
	});

	it('normalizes equivalent cell spellings so they match stored values', () => {
		expect(normalizeCustomFieldCells({ 'cf:3': 'y' }, [boolDef])).toEqual({
			'cf:3': 'TRUE',
		});
		expect(
			normalizeCustomFieldCells({ 'cf:1': '  North  ' }, [textDef]),
		).toEqual({ 'cf:1': 'North' });
	});

	it('reports an invalid select option as a row error at parse time', () => {
		const header = `${importHeaders('contacts', 'template', [
			requiredSelectDef,
		]).join(',')}`;
		const { rows } = parseImportCsv(
			'contacts',
			`${header}\nAlex,,,,Bronze`,
			[requiredSelectDef],
		);
		expect(rows[0].errors).toEqual([
			'Tier must be one of the configured options',
		]);
	});

	it('leaves a blank required cell as a blank cell after parse', () => {
		const header = importHeaders('contacts', 'template', [
			requiredSelectDef,
		]).join(',');
		const { rows } = parseImportCsv('contacts', `${header}\nAlex,,,,`, [
			requiredSelectDef,
		]);
		expect(rows[0].errors).toEqual([]);
		expect(rows[0].fields['cf:2']).toBe('');
	});

	it('exports stored values as round-trippable cells', () => {
		const cells = storedCustomFieldCells(
			{
				'1': 'North',
				'2': CUSTOM_FIELD_IMPORT_PLACEHOLDER,
				'3': true,
			},
			[textDef, requiredSelectDef, boolDef],
		);
		expect(cells).toEqual({
			'cf:1': 'North',
			'cf:2': '',
			'cf:3': 'TRUE',
		});
	});

	it('current export appends custom field columns', async () => {
		customFieldMocks.defs = [textDef];
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 1,
					name: 'Alex',
					title: '',
					phone: '',
					email: 'alex@example.com',
					custom_fields: { '1': 'North' },
				},
			],
		});
		const rows = await buildImportCsvRows('contacts', 'current');
		expect(rows[0].at(-1)).toBe('Region');
		expect(rows[1].at(-1)).toBe('North');
	});

	it('flags a conflict when only a custom field differs', async () => {
		dbMocks.query.mockResolvedValueOnce({
			rows: [
				{
					id: 7,
					name: 'Alex',
					title: '',
					phone: '',
					email: 'alex@example.com',
					custom_fields: { '1': 'South' },
				},
			],
		});
		const result = await previewContactsImport(
			[
				{
					rowIndex: 2,
					fields: {
						name: 'Alex',
						title: '',
						phone: '',
						email: 'alex@example.com',
						'cf:1': 'North',
					},
					errors: [],
				},
			],
			[textDef],
		);
		expect(result.summary.conflict).toBe(1);
		expect(result.rows[0].existing?.['cf:1']).toBe('South');
		expect(result.rows[0].imported['cf:1']).toBe('North');
	});

	it('persists custom fields on insert', async () => {
		dbMocks.query.mockResolvedValueOnce({ rowCount: 1 });
		await applyContactsImport(
			[
				{
					rowIndex: 2,
					status: 'new',
					imported: {
						name: 'Alex',
						title: '',
						phone: '',
						email: '',
						'cf:1': 'North',
					},
				},
			],
			[textDef, requiredSelectDef],
		);
		expect(dbMocks.query).toHaveBeenCalledWith(expect.any(String), [
			'Alex',
			null,
			null,
			null,
			JSON.stringify({ '1': 'North', '2': CUSTOM_FIELD_IMPORT_PLACEHOLDER }),
		]);
	});
});
