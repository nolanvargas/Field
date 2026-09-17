/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import {
	MARGIN,
	PAGE_HEIGHT,
	attachmentGridMetrics,
	display,
	fillInText,
	formatBodyDate,
	formatFooterDate,
	htmlToPlainText,
	normalizeText,
	planInlineAttachments,
} from '../server/pdfLayout.mjs';

describe('normalizeText', () => {
	it('converts CRLF and lone CR to LF', () => {
		expect(normalizeText('a\r\nb\rc')).toBe('a\nb\nc');
	});
});

describe('htmlToPlainText', () => {
	it('strips tags and preserves list markers', () => {
		expect(htmlToPlainText('<p>Hello</p><ul><li>One</li><li>Two</li></ul>')).toBe(
			'Hello • One • Two',
		);
	});

	it('decodes common entities and treats br as newline', () => {
		expect(htmlToPlainText('Line&nbsp;1<br/>Line&nbsp;2')).toBe('Line 1 Line 2');
	});

	it('returns empty for null and blank', () => {
		expect(htmlToPlainText(null)).toBe('');
		expect(htmlToPlainText('   ')).toBe('');
	});

	it('leaves plain text alone', () => {
		expect(htmlToPlainText('  plain text  ')).toBe('plain text');
	});
});

describe('display vs fillInText', () => {
	it('display returns n/a for empty values', () => {
		expect(display(null)).toBe('n/a');
		expect(display('')).toBe('n/a');
		expect(display('  ')).toBe('n/a');
		expect(display('value')).toBe('value');
	});

	it('fillInText stays blank for missing or n/a values', () => {
		expect(fillInText(null)).toBe('');
		expect(fillInText('')).toBe('');
		expect(fillInText('n/a')).toBe('');
		expect(fillInText('signed')).toBe('signed');
	});
});

describe('formatBodyDate', () => {
	it('returns n/a for missing or invalid ISO', () => {
		expect(formatBodyDate(null)).toBe('n/a');
		expect(formatBodyDate('')).toBe('n/a');
		expect(formatBodyDate('not-a-date')).toBe('n/a');
	});

	it('formats a valid ISO timestamp', () => {
		const formatted = formatBodyDate('2026-07-15T14:09:00');
		expect(formatted).toMatch(/^Jul 15 2026 \d{2}:\d{2} (AM|PM)$/);
	});
});

describe('formatFooterDate', () => {
	it('formats as YYYY-MM-DD HH:mm', () => {
		const formatted = formatFooterDate(new Date('2026-07-15T14:11:00'));
		expect(formatted).toMatch(/^2026-07-15 \d{2}:\d{2}$/);
	});
});

describe('planInlineAttachments', () => {
	it('returns one page when there are no images', () => {
		const plan = planInlineAttachments(PAGE_HEIGHT, MARGIN + 200, 0);
		expect(plan.pageCount).toBe(1);
		expect(plan.cellWidth).toBeGreaterThan(0);
	});

	it('adds pages when many images exceed the first page grid', () => {
		const { cellHeight } = attachmentGridMetrics();
		const bottom = PAGE_HEIGHT - MARGIN - 28;
		const rowsPerPage = Math.floor((bottom - MARGIN) / cellHeight);
		const cellsPerPage = rowsPerPage * 3;
		const imageCount = cellsPerPage + 1;
		const plan = planInlineAttachments(PAGE_HEIGHT, MARGIN + 100, imageCount);
		expect(plan.pageCount).toBeGreaterThan(1);
	});
});
