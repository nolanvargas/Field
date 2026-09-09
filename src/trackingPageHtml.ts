import DOMPurify from 'dompurify';
import { isLikelyHtml } from './taskDescHtml';

const ALLOWED_TAGS = [
	'p',
	'br',
	'strong',
	'b',
	'em',
	'i',
	'u',
	'ul',
	'ol',
	'li',
	'h1',
	'h2',
	'h3',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
];

const ALLOWED_ATTR = ['colspan', 'rowspan'];

/** Sanitize public-page rich text HTML (includes tables). */
export function sanitizeTrackingPageHtml(html: string): string {
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS,
		ALLOWED_ATTR,
	});
}

/** True when HTML is empty after sanitization. */
export function isEmptyTrackingPageHtml(value: string | null | undefined): boolean {
	if (value == null) return true;
	const trimmed = value.trim();
	if (!trimmed) return true;
	if (!isLikelyHtml(trimmed)) return false;
	const stripped = sanitizeTrackingPageHtml(trimmed)
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.trim();
	return stripped.length === 0;
}
