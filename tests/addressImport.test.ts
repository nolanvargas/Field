/**
 * Manual QA (not covered here):
 * 1. Management → Import / export: upload addresses CSV; preview new/update/conflict/error; 500-char error in UI.
 * 2. Export current: Street column holds full address line; city/state/postal columns are blank — edit street or fill other columns and re-import.
 * 3. Google Sheets workflow: template headers match (no Street number / Country columns).
 * 4. Conflict detection: same address name, different formatted street_line → conflict in preview.
 */
import { describe, expect, it } from 'vitest';
import { formatStreetLineFromImportParts } from '../shared/addressImport.js';
import { SAMPLE_ADDRESS_ROWS } from '../shared/importSampleData.js';

/** Expected street_line for each sample row (import path sheet authors use). */
const SAMPLE_STREET_LINES: Record<string, string> = {
	'North Warehouse': '100 Industrial Blvd, Springfield, IL 62701',
	'Downtown Office': '42 Market Street, Boston, MA 02108',
	'Riverside Park': '800 River Road, Austin, TX 78701',
	'East Distribution': '15 Freight Lane, Columbus, OH 43215',
	'Convention Center': '500 Expo Drive, Denver, CO 80202',
	'Harbor Storage': '22 Pier Avenue, Seattle, WA 98101',
	'University Campus': '1 College Way, Ann Arbor, MI 48104',
	'Suburban Retail': '900 Shopping Center Dr, Phoenix, AZ 85004',
	'Airport Cargo': 'Terminal Road, Atlanta, GA 30320',
	'Community Center': '77 Oak Street, Portland, OR 97201',
};

describe('addressImport', () => {
	describe('formatStreetLineFromImportParts', () => {
		describe('empty and nullish inputs', () => {
			it('returns empty string for missing or blank parts', () => {
				expect(formatStreetLineFromImportParts({})).toBe('');
				expect(
					formatStreetLineFromImportParts({
						street: '',
						city: '',
						state: '',
						postalCode: '',
					}),
				).toBe('');
			});

			it('returns empty string when all fields are whitespace', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '   \t\n',
						city: '  ',
						state: '\t',
						postalCode: ' \n',
					}),
				).toBe('');
			});

			it('treats null and undefined fields as empty', () => {
				expect(
					formatStreetLineFromImportParts({
						street: null,
						city: undefined,
						state: 'IL',
						postalCode: null,
					}),
				).toBe('IL');
			});
		});

		describe('whitespace normalization', () => {
			it('collapses internal whitespace and trims each field', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '  100   Industrial   Blvd  ',
						city: '  Springfield  ',
						state: ' IL ',
						postalCode: ' 62701 ',
					}),
				).toBe('100 Industrial Blvd, Springfield, IL 62701');
			});
		});

		describe('partial column combinations', () => {
			it('joins all populated columns into a comma-separated line', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '100 Industrial Blvd',
						city: 'Springfield',
						state: 'IL',
						postalCode: '62701',
					}),
				).toBe('100 Industrial Blvd, Springfield, IL 62701');
			});

			it('uses street alone when city and state are blank', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '3770 S Las Vegas Blvd, Las Vegas, NV 89109',
					}),
				).toBe('3770 S Las Vegas Blvd, Las Vegas, NV 89109');
			});

			it('omits empty segments when state is missing', () => {
				expect(
					formatStreetLineFromImportParts({
						street: 'Terminal Road',
						city: 'Atlanta',
						postalCode: '30320',
					}),
				).toBe('Terminal Road, Atlanta, 30320');
			});

			it('formats street-only lines', () => {
				expect(
					formatStreetLineFromImportParts({ street: 'Terminal Road' }),
				).toBe('Terminal Road');
			});

			it('formats city, state, and postal without street', () => {
				expect(
					formatStreetLineFromImportParts({
						city: 'Springfield',
						state: 'IL',
						postalCode: '62701',
					}),
				).toBe('Springfield, IL 62701');
			});

			it('formats street and city without state or postal', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '42 Market Street',
						city: 'Boston',
					}),
				).toBe('42 Market Street, Boston');
			});

			it('joins state and ZIP+4 with a space', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '42 Market Street',
						city: 'Boston',
						state: 'MA',
						postalCode: '02108-1234',
					}),
				).toBe('42 Market Street, Boston, MA 02108-1234');
			});

			it('formats city and state without postal code', () => {
				expect(
					formatStreetLineFromImportParts({
						street: '100 Industrial Blvd',
						city: 'Springfield',
						state: 'IL',
					}),
				).toBe('100 Industrial Blvd, Springfield, IL');
			});
		});

		describe('sample address rows', () => {
			it.each(SAMPLE_ADDRESS_ROWS)(
				'formats $addressName sample row',
				(row) => {
					const expected = SAMPLE_STREET_LINES[row.addressName];
					expect(expected).toBeDefined();
					expect(
						formatStreetLineFromImportParts({
							street: row.street,
							city: row.city,
							state: row.state,
							postalCode: row.postalCode,
						}),
					).toBe(expected);
				},
			);
		});

		describe('edge and adversarial inputs', () => {
			it('passes special characters through unchanged', () => {
				expect(
					formatStreetLineFromImportParts({
						street: 'Main & Oak "Plaza"',
						city: 'Boston',
						state: 'MA',
						postalCode: '02108',
					}),
				).toBe('Main & Oak "Plaza", Boston, MA 02108');
			});

			it('does not throw on oversized input and preserves length', () => {
				const longStreet = 'A'.repeat(600);
				const result = formatStreetLineFromImportParts({ street: longStreet });
				expect(result).toBe(longStreet);
				expect(result.length).toBe(600);
			});

			it('does not throw on injection-like literals', () => {
				const street = '{{constructor.constructor}}, City, IL 62701';
				expect(formatStreetLineFromImportParts({ street })).toBe(street);
			});
		});
	});
});
