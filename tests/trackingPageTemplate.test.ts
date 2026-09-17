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

	it('does not include a default text block', () => {
		const template = defaultTrackingPageTemplate('Delivery');
		expect(template.blocks.some((b) => b.type === 'text')).toBe(false);
	});

	it('includes image attachments block with default tatKeys', () => {
		const template = defaultTrackingPageTemplate('Delivery');
		const images = template.blocks.find((b) => b.type === 'imageAttachments');
		expect(images?.tatKeys).toEqual(['completion_photos']);
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
					{ id: 'a', type: 'imageAttachments', tatKeys: ['completion_photos'] },
					{ id: 'b', type: 'imageAttachments', tatKeys: [] },
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

	it('uses generic defaults when task type name is omitted', () => {
		const template = normalizeTrackingPageTemplate(null);
		const docs = template.blocks.find((b) => b.type === 'documents');
		expect(docs?.kinds).toEqual(['proof_of_completion']);
		const details = template.blocks.find((b) => b.type === 'detailRows');
		expect(details?.rows?.some((r) => r.label === 'Location')).toBe(true);
		expect(details?.rows?.some((r) => r.label === 'Delivered to')).toBe(false);
	});
});

describe('substituteMergeTags', () => {
	it('replaces known tags', () => {
		const html = '<h1>{{task.job_title}}</h1><p>{{task.status}}</p>';
		const result = substituteMergeTags(html, {
			'task.job_title': '12345',
			'task.status': 'Completed',
		});
		expect(result).toBe('<h1>12345</h1><p>Completed</p>');
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
