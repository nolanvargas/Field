/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { parseCsv, serializeCsv } from '../shared/csv.js';

describe('shared/csv edge cases', () => {
	it('parses doubled quotes inside quoted fields', () => {
		expect(parseCsv('"Say ""hello""",ok')).toEqual([['Say "hello"', 'ok']]);
	});

	it('round-trips embedded quotes via serializeCsv', () => {
		const rows = [['He said "yes"', 'done']];
		expect(parseCsv(serializeCsv(rows))).toEqual(rows);
	});

	it('preserves internal newlines inside quoted fields', () => {
		const text = '"line1\nline2",b';
		expect(parseCsv(text)).toEqual([['line1\nline2', 'b']]);
	});

	it('treats unclosed quotes as literal content through end of input', () => {
		expect(parseCsv('"open field,still open')).toEqual([['open field,still open']]);
	});

	it('documents lone empty quoted field parsing quirk', () => {
		expect(parseCsv('""')).toEqual([]);
		expect(parseCsv('a,"""",b')).toEqual([['a', '"', 'b']]);
	});
});
