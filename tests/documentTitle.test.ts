import { describe, expect, it } from 'vitest';
import { formatDocumentTitle, pageTitleForPath } from '../src/documentTitle';

describe('formatDocumentTitle', () => {
	it('returns Field for empty or default page names', () => {
		expect(formatDocumentTitle(null)).toBe('Field');
		expect(formatDocumentTitle('Field')).toBe('Field');
	});

	it('returns the page name alone', () => {
		expect(formatDocumentTitle('Contacts')).toBe('Contacts');
	});
});

describe('pageTitleForPath', () => {
	const taskTypes = [
		{ name: 'Delivery', pluralName: 'Deliveries' },
		{ name: 'Pickup', pluralName: 'Pickups' },
	];

	it('maps task list routes with org type filters', () => {
		expect(pageTitleForPath('/tasks', [], taskTypes)).toBe('All Tasks');
		expect(pageTitleForPath('/my-tasks', [], taskTypes)).toBe('My Tasks');
		expect(pageTitleForPath('/tasks', ['Delivery'], taskTypes)).toBe(
			'All Deliveries',
		);
		expect(pageTitleForPath('/my-tasks', ['Delivery'], taskTypes)).toBe(
			'My Deliveries',
		);
	});

	it('maps tracking and task detail routes', () => {
		expect(pageTitleForPath('/t/abc123', [], taskTypes)).toBe('Order tracking');
		expect(pageTitleForPath('/task/42', [], taskTypes)).toBe('Task');
		expect(pageTitleForPath('/task/42/complete', [], taskTypes)).toBe(
			'Complete Task',
		);
		expect(pageTitleForPath('/task/42/deliver', [], taskTypes)).toBe(
			'Deliver Task',
		);
	});

	it('maps known static routes and falls back to Field', () => {
		expect(pageTitleForPath('/contacts', [], taskTypes)).toBe('Contacts');
		expect(pageTitleForPath('/unknown', [], taskTypes)).toBe('Field');
	});
});
