import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
	readMobileTaskCardCompact,
	writeMobileTaskCardCompact,
	MOBILE_TASK_CARD_COMPACT_KEY,
	getTaskColumnOptions,
} from '../src/agGridDefaults';
import {
	isTaskColumnValueEmpty,
	labeledMobileTaskCardFields,
	orderedVisibleTaskCardFields,
	renderTaskColumnValue,
	taskCardShowsCombinedWindowRow,
	taskCardShowsWindowRow,
	taskShowsDescriptionBlock,
} from '../src/taskColumnDisplay';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Task } from '../src/types/task';

const baseTask: Task = {
	id: 1,
	taskType: 'Delivery',
	status: 'Assigned',
	externalKey: 'JOB-1',
	jobTitle: 'Widgets',
	description: '',
	destinationAddress: '123 Main St',
	windowStartAt: '2026-03-20T10:00:00.000Z',
	windowEndAt: '2026-03-20T12:00:00.000Z',
	contactNames: 'Alice',
	crewName: 'Bob Smith',
	createdByName: 'Carol Admin',
	myLive: false,
	customFields: {},
};

describe('mobile task card compact pref', () => {
	beforeEach(() => {
		localStorage.removeItem(MOBILE_TASK_CARD_COMPACT_KEY);
	});

	afterEach(() => {
		localStorage.removeItem(MOBILE_TASK_CARD_COMPACT_KEY);
	});

	it('defaults to false and persists toggles', () => {
		expect(readMobileTaskCardCompact()).toBe(false);
		writeMobileTaskCardCompact(true);
		expect(readMobileTaskCardCompact()).toBe(true);
		writeMobileTaskCardCompact(false);
		expect(readMobileTaskCardCompact()).toBe(false);
	});
});

describe('taskColumnDisplay', () => {
	const columnOptions = getTaskColumnOptions('Job', []);

	it('orders visible fields by catalog', () => {
		const ordered = orderedVisibleTaskCardFields(
			['windowStartAt', 'externalKey', 'jobTitle'],
			columnOptions,
		);
		expect(ordered).toEqual(['externalKey', 'jobTitle', 'windowStartAt']);
	});

	it('formats external key and crew name', () => {
		expect(
			renderTaskColumnValue(baseTask, 'externalKey', {}),
		).toBe('JOB-1');
		expect(renderTaskColumnValue(baseTask, 'crewName', {})).toBe(
			'Bob Smith',
		);
	});

	it('renders status badge markup', () => {
		const html = renderToStaticMarkup(
			createElement(
				Fragment,
				null,
				renderTaskColumnValue(baseTask, 'status', {}),
			),
		);
		expect(html).toContain('Assigned');
	});

	it('window row when start and/or end columns are on', () => {
		expect(
			taskCardShowsCombinedWindowRow(['windowStartAt', 'windowEndAt']),
		).toBe(true);
		expect(taskCardShowsCombinedWindowRow(['windowStartAt'])).toBe(
			true,
		);
		expect(taskCardShowsCombinedWindowRow(['windowEndAt'])).toBe(true);
		expect(
			taskCardShowsWindowRow(baseTask, ['windowStartAt', 'windowEndAt']),
		).toBe(true);
		expect(
			taskCardShowsWindowRow(baseTask, ['windowStartAt']),
		).toBe(true);
		expect(taskCardShowsWindowRow(baseTask, ['jobTitle'])).toBe(
			false,
		);
		const noWindow = {
			...baseTask,
			windowStartAt: null,
			windowEndAt: null,
		};
		expect(
			taskCardShowsWindowRow(noWindow, ['windowStartAt', 'windowEndAt']),
		).toBe(false);
	});

	it('isTaskColumnValueEmpty matches missing card values', () => {
		const sparse = {
			...baseTask,
			jobTitle: '',
			destinationAddress: '  ',
			crewName: null as unknown as string,
		};
		expect(isTaskColumnValueEmpty(sparse, 'jobTitle', {})).toBe(
			true,
		);
		expect(
			isTaskColumnValueEmpty(sparse, 'destinationAddress', {}),
		).toBe(true);
		expect(isTaskColumnValueEmpty(sparse, 'crewName', {})).toBe(
			true,
		);
		expect(isTaskColumnValueEmpty(baseTask, 'crewName', {})).toBe(
			false,
		);
	});

	it('labeled mobile fields exclude packed builtins', () => {
		expect(
			labeledMobileTaskCardFields(
				['externalKey', 'crewName', 'contactNames'],
				columnOptions,
			),
		).toEqual(['contactNames']);
	});

	it('shows description block only when column visible and non-empty', () => {
		expect(
			taskShowsDescriptionBlock(baseTask, ['description']),
		).toBe(false);
		const withDesc = {
			...baseTask,
			description: '<p>Bring photo</p>',
		};
		expect(
			taskShowsDescriptionBlock(withDesc, ['jobTitle']),
		).toBe(false);
		expect(
			taskShowsDescriptionBlock(withDesc, ['description']),
		).toBe(true);
	});
});
