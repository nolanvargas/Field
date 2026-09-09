import { describe, expect, it } from 'vitest';
import {
	defaultTrackingPageTemplate,
	normalizeTrackingPageTemplate,
	trackingPageTemplateFromDb,
	substituteMergeTags,
} from '../shared/trackingPageTemplate.js';
import { sanitizeTrackingPageHtml } from '../src/trackingPageHtml';

describe('defaultTrackingPageTemplate', () => {
	it('includes delivery docket for Delivery type', () => {
		const template = defaultTrackingPageTemplate('Delivery');
		const docs = template.blocks.find((b) => b.type === 'documents');
		expect(docs?.kinds).toContain('delivery_docket');
	});

	it('omits delivery docket for non-delivery types', () => {
		const template = defaultTrackingPageTemplate('Install');
		const docs = template.blocks.find((b) => b.type === 'documents');
		expect(docs?.kinds).toEqual(['proof_of_completion']);
	});

	it('uses headline merge tag in default text block', () => {
		const template = defaultTrackingPageTemplate('Delivery');
		const text = template.blocks.find((b) => b.type === 'text');
		expect(text?.html).toContain('{{task.headline}}');
	});
});

describe('normalizeTrackingPageTemplate', () => {
	it('rejects v1 templates', () => {
		expect(() =>
			normalizeTrackingPageTemplate({
				version: 1,
				canvas: { aspectRatio: '3/4' },
				regions: [],
			}),
		).toThrow(/version must be 2/);
	});

	it('rejects duplicate block ids', () => {
		expect(() =>
			normalizeTrackingPageTemplate({
				version: 2,
				blocks: [
					{ id: 'a', type: 'history' },
					{ id: 'a', type: 'history' },
				],
			}),
		).toThrow(/Duplicate block id/);
	});

	it('rejects duplicate singleton block types', () => {
		expect(() =>
			normalizeTrackingPageTemplate({
				version: 2,
				blocks: [
					{ id: 'a', type: 'history' },
					{ id: 'b', type: 'history' },
				],
			}),
		).toThrow(/Duplicate History block/);

		expect(() =>
			normalizeTrackingPageTemplate({
				version: 2,
				blocks: [
					{ id: 'a', type: 'documents', kinds: ['delivery_docket'] },
					{ id: 'b', type: 'documents', kinds: ['proof_of_completion'] },
				],
			}),
		).toThrow(/Duplicate Documents block/);

		expect(() =>
			normalizeTrackingPageTemplate({
				version: 2,
				blocks: [
					{ id: 'a', type: 'imageAttachments' },
					{ id: 'b', type: 'imageAttachments' },
				],
			}),
		).toThrow(/Duplicate Completion images block/);
	});

	it('normalizes spacer size to md when invalid', () => {
		const template = normalizeTrackingPageTemplate({
			version: 2,
			blocks: [{ id: 's', type: 'spacer', size: 'huge' }],
		});
		expect(template.blocks[0]).toMatchObject({ type: 'spacer', size: 'md' });
	});
});

describe('substituteMergeTags', () => {
	it('replaces known tags', () => {
		const html = '<h1>{{task.headline}}</h1><p>{{task.status}}</p>';
		const result = substituteMergeTags(html, {
			'task.headline': 'Delivered!',
			'task.status': 'Completed',
		});
		expect(result).toBe('<h1>Delivered!</h1><p>Completed</p>');
	});

	it('leaves unknown tags intact', () => {
		const html = '<p>{{unknown.tag}}</p>';
		const result = substituteMergeTags(html, { 'task.status': 'Done' });
		expect(result).toBe('<p>{{unknown.tag}}</p>');
	});
});

describe('sanitizeTrackingPageHtml', () => {
	it('preserves table markup', () => {
		const html =
			'<table><thead><tr><th>A</th></tr></thead><tbody><tr><td colspan="2">B</td></tr></tbody></table>';
		const result = sanitizeTrackingPageHtml(html);
		expect(result).toContain('<table>');
		expect(result).toContain('colspan="2"');
	});

	it('strips unsafe tags and attrs', () => {
		const html = '<p onclick="alert(1)">Hi</p><script>alert(1)</script>';
		const result = sanitizeTrackingPageHtml(html);
		expect(result).not.toContain('script');
		expect(result).not.toContain('onclick');
		expect(result).toContain('Hi');
	});
});

describe('trackingPageTemplateFromDb', () => {
	it('returns default when db value is null', () => {
		const template = trackingPageTemplateFromDb(null, 'Pickup');
		expect(template.blocks.length).toBeGreaterThan(0);
		expect(template.version).toBe(2);
	});
});
