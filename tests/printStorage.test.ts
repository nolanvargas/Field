/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	CURRENT_PRINT_STORAGE_PREFIX,
	printFileName,
	printStorageKey,
	printStorageKind,
} from '../server/printStorage.mjs';

describe('printStorageKind', () => {
	it('trims document type', () => {
		expect(printStorageKind('  delivery_docket  ')).toBe('delivery_docket');
	});

	it('coerces nullish to empty string', () => {
		expect(printStorageKind(null)).toBe('');
		expect(printStorageKind(undefined)).toBe('');
	});
});

describe('printFileName', () => {
	it('builds a safe pdf filename from type and entity id', () => {
		expect(printFileName('delivery_docket', 42)).toBe('delivery_docket-42.pdf');
	});

	it('replaces unsafe characters in type and id', () => {
		expect(printFileName('invoice/report', 99)).toBe('invoice_report-99.pdf');
		expect(printFileName('pod', 'task/12')).toBe('pod-task_12.pdf');
	});
});

describe('printStorageKey', () => {
	it('prefixes the current storage version', () => {
		expect(printStorageKey('pod', 7)).toBe(
			`${CURRENT_PRINT_STORAGE_PREFIX}pod-7.pdf`,
		);
		expect(CURRENT_PRINT_STORAGE_PREFIX).toBe('documents/v5/');
	});
});
