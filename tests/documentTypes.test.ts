import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	defaultTrackingDocumentKinds,
	defaultTrackingPageDocumentKinds,
	documentGeneratedHistoryTitle,
	documentKindLabel,
	getDocumentType,
	isValidDocumentType,
} from '../shared/documentTypes.js';

describe('documentTypes registry', () => {
	it('lists tracking-page document kinds from registry', () => {
		expect(defaultTrackingDocumentKinds()).toEqual([
			'delivery_docket',
			'proof_of_completion',
		]);
	});

	it('omits delivery docket from non-delivery tracking page defaults', () => {
		expect(defaultTrackingPageDocumentKinds('Install')).toEqual([
			'proof_of_completion',
		]);
		expect(defaultTrackingPageDocumentKinds('Delivery')).toContain(
			'delivery_docket',
		);
	});

	it('labels known document kinds', () => {
		expect(documentKindLabel('delivery_docket')).toBe('Delivery docket');
		expect(documentKindLabel('delivery_docket', 2)).toBe('Delivery dockets');
	});

	it('builds history titles from registry labels', () => {
		expect(documentGeneratedHistoryTitle('proof_of_completion')).toBe(
			'Proof of completion available',
		);
	});

	it('validates registry keys', () => {
		expect(isValidDocumentType('invoice')).toBe(true);
		expect(isValidDocumentType('task_summary')).toBe(false);
		expect(getDocumentType('invoice')?.label).toBe('Invoice');
	});
});

describe('delivery docket seed JSON', () => {
	it('loads and validates the seed file', async () => {
		const root = path.resolve(
			path.dirname(fileURLToPath(import.meta.url)),
			'..',
		);
		const raw = await readFile(
			path.join(root, 'document-templates/delivery_docket.json'),
			'utf8',
		);
		const parsed = JSON.parse(raw) as { label?: string; context?: string };
		expect(parsed.label).toBe('Delivery Docket');
		expect(parsed.context).toBe('task');
	});
});
