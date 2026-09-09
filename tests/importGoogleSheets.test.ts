import { describe, expect, it, vi } from 'vitest';
import {
	buildImportGoogleSheetCopyUrl,
	getImportGoogleSheetUrl,
	isValidImportGoogleSheetCopyUrl,
	normalizeImportGoogleSheetId,
	parseImportGoogleSheets,
} from '../shared/importGoogleSheets.js';

const CONTACTS_ID = 'abc123XYZ-_';
const ADDRESSES_ID = 'def456XYZ-_';
const CONTACTS_COPY = `https://docs.google.com/spreadsheets/d/${CONTACTS_ID}/copy`;
const ADDRESSES_COPY = `https://docs.google.com/spreadsheets/d/${ADDRESSES_ID}/copy`;

describe('importGoogleSheets', () => {
	it('builds copy URL from spreadsheet ID', () => {
		expect(buildImportGoogleSheetCopyUrl(CONTACTS_ID)).toBe(CONTACTS_COPY);
		expect(isValidImportGoogleSheetCopyUrl(CONTACTS_COPY)).toBe(true);
		expect(isValidImportGoogleSheetCopyUrl('https://example.com/x')).toBe(
			false,
		);
	});

	it('normalizes bare ID or full Google Sheets URL', () => {
		expect(normalizeImportGoogleSheetId(CONTACTS_ID)).toBe(CONTACTS_ID);
		expect(
			normalizeImportGoogleSheetId(
				`https://docs.google.com/spreadsheets/d/${CONTACTS_ID}/edit#gid=0`,
			),
		).toBe(CONTACTS_ID);
		expect(() => normalizeImportGoogleSheetId('bad/id')).toThrow(
			/Invalid Google Sheet ID/,
		);
	});

	it('parses entity map of spreadsheet IDs from JSON', () => {
		const raw = JSON.stringify({
			contacts: CONTACTS_ID,
			addresses: ADDRESSES_ID,
			users: '  ',
			extra: 'ignored',
		});
		expect(parseImportGoogleSheets(raw)).toEqual({
			contacts: CONTACTS_COPY,
			addresses: ADDRESSES_COPY,
		});
	});

	it('accepts full URLs in JSON and still emits /copy links', () => {
		const raw = JSON.stringify({
			contacts: `https://docs.google.com/spreadsheets/d/${CONTACTS_ID}/edit`,
		});
		expect(parseImportGoogleSheets(raw)).toEqual({
			contacts: CONTACTS_COPY,
		});
	});

	it('returns empty map for blank or invalid JSON', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(parseImportGoogleSheets(undefined)).toEqual({});
		expect(parseImportGoogleSheets('{}')).toEqual({});
		expect(parseImportGoogleSheets('not json')).toEqual({});
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('getImportGoogleSheetUrl returns URL for configured entity', () => {
		const sheets = parseImportGoogleSheets(
			JSON.stringify({ contacts: CONTACTS_ID }),
		);
		expect(getImportGoogleSheetUrl('contacts', sheets)).toBe(CONTACTS_COPY);
		expect(getImportGoogleSheetUrl('users', sheets)).toBeNull();
		expect(getImportGoogleSheetUrl('contacts', null)).toBeNull();
	});
});
