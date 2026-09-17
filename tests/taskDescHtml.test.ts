import { describe, expect, it } from 'vitest';
import {
	htmlToPlainText,
	isEmptyTaskDesc,
	isLikelyHtml,
	sanitizeTaskDescHtml,
} from '../src/taskDescHtml';

describe('isLikelyHtml', () => {
	it('detects HTML tags', () => {
		expect(isLikelyHtml('<p>Hello</p>')).toBe(true);
		expect(isLikelyHtml('Deliver to rear dock')).toBe(false);
		expect(isLikelyHtml('Arrive before < 9am')).toBe(false);
	});
});

describe('sanitizeTaskDescHtml', () => {
	it('strips script tags and content', () => {
		const dirty = '<p>Hi</p><script>alert(1)</script>';
		expect(sanitizeTaskDescHtml(dirty)).toBe('<p>Hi</p>');
	});

	it('strips event handler attributes', () => {
		const dirty = '<p onclick="evil()">Click</p>';
		expect(sanitizeTaskDescHtml(dirty)).toBe('<p>Click</p>');
	});

	it('strips unknown tags while keeping allowed formatting', () => {
		const dirty =
			'<p><strong>Bold</strong></p><iframe src="x"></iframe><ul><li>One</li></ul>';
		expect(sanitizeTaskDescHtml(dirty)).toBe(
			'<p><strong>Bold</strong></p><ul><li>One</li></ul>',
		);
	});
});

describe('htmlToPlainText', () => {
	it('collapses plain text whitespace', () => {
		expect(htmlToPlainText('  Ring   twice  ')).toBe('Ring twice');
	});

	it('converts breaks and list items to readable text', () => {
		const html = '<p>Line one</p><p>Line two</p><ul><li>Apple</li><li>Banana</li></ul>';
		expect(htmlToPlainText(html)).toBe('Line one Line two • Apple • Banana');
	});

	it('handles br tags', () => {
		expect(htmlToPlainText('A<br>B<br/>C')).toBe('A B C');
	});
});

describe('isEmptyTaskDesc', () => {
	it('treats null, blank, and editor-empty HTML as empty', () => {
		expect(isEmptyTaskDesc(null)).toBe(true);
		expect(isEmptyTaskDesc('')).toBe(true);
		expect(isEmptyTaskDesc('   ')).toBe(true);
		expect(isEmptyTaskDesc('<p></p>')).toBe(true);
		expect(isEmptyTaskDesc('<p>&nbsp;</p>')).toBe(true);
	});

	it('treats non-empty plain text and HTML as non-empty', () => {
		expect(isEmptyTaskDesc('Call on arrival')).toBe(false);
		expect(isEmptyTaskDesc('<p>Notes</p>')).toBe(false);
	});
});
