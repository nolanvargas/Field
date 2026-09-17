import { MantineProvider } from '@mantine/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OrgCustomFieldDef } from '../src/api/orgSettings';
import {
	customFieldColumnId,
	getTaskColumnOptions,
} from '../src/agGridDefaults';
import { TaskCards } from '../src/components/TaskCards';
import {
	labeledMobileTaskCardFields,
	taskCardHeaderLabel,
} from '../src/taskColumnDisplay';
import type { Task } from '../src/types/task';

const baseTask: Task = {
	id: 1,
	taskType: 'Delivery',
	status: 'Assigned',
	externalKey: 'JOB-1',
	jobTitle: 'Widgets',
	description: '<p>Bring photo</p>',
	destinationAddress: '123 Main St',
	windowStartAt: '2026-03-20T10:00:00.000Z',
	windowEndAt: '2026-03-20T12:00:00.000Z',
	contactNames: 'Alice',
	crewName: 'Bob Smith',
	createdByName: 'Carol Admin',
	myLive: false,
	customFields: { '1': 'Forklift' },
};

const customFieldDefs: OrgCustomFieldDef[] = [
	{
		slot: 1,
		label: 'Equipment',
		dataType: 'text',
		required: false,
		lookupTable: null,
		options: [],
	},
];

function renderCard(
	visibleFields: string[],
	task: Task = baseTask,
) {
	const columnOptions = getTaskColumnOptions('Job', customFieldDefs);
	return renderToStaticMarkup(
		createElement(
			MantineProvider,
			null,
			createElement(TaskCards, {
				tasks: [task],
				onSelect: () => {},
				visibleFields,
				columnOptions,
				customFieldDefs,
			}),
		),
	);
}

describe('labeledMobileTaskCardFields', () => {
	const columnOptions = getTaskColumnOptions('Job', customFieldDefs);

	it('includes contacts and custom fields only', () => {
		const fields = labeledMobileTaskCardFields(
			[
				'externalKey',
				'jobTitle',
				'destinationAddress',
				'contactNames',
				customFieldColumnId(1),
			],
			columnOptions,
		);
		expect(fields).toEqual(['contactNames', customFieldColumnId(1)]);
	});
});

describe('taskCardHeaderLabel', () => {
	it('combines type and job when both visible', () => {
		expect(
			taskCardHeaderLabel(baseTask, ['taskType', 'externalKey']),
		).toBe('Delivery - JOB-1');
	});

	it('shows key only when type hidden', () => {
		expect(taskCardHeaderLabel(baseTask, ['externalKey'])).toBe('JOB-1');
	});
});

describe('TaskCards packed layout', () => {
	const defaultVisible = [
		'externalKey',
		'jobTitle',
		'taskType',
		'destinationAddress',
		'windowStartAt',
		'windowEndAt',
	];

	it('labels window row only when start and end columns are on', () => {
		const startOnly = renderCard([
			'externalKey',
			'taskType',
			'windowStartAt',
		]);
		expect(startOnly).toContain('Start');
		expect(startOnly).not.toContain('task-card-row-label">Window');

		const both = renderCard([
			'externalKey',
			'taskType',
			'windowStartAt',
			'windowEndAt',
		]);
		expect(both).toContain('task-card-row-label">Window');
	});

	it('renders header and packed Location row', () => {
		const html = renderCard(defaultVisible);
		expect(html).toContain('task-card-header');
		expect(html).toContain('Delivery - JOB-1');
		expect(html).toContain('Assigned');
		expect(html).toContain('task-card-job-title');
		expect(html).toContain('Widgets');
		expect(html).toContain('Location');
		expect(html).toContain('123 Main St');
		expect(html).toContain('Window');
	});

	it('omits packed rows when columns are off', () => {
		const html = renderCard(['externalKey', 'taskType']);
		expect(html).not.toContain('Location');
		expect(html).not.toContain('Window');
		expect(html).not.toContain('task-card-job-title');
	});

	it('renders contacts as labeled row, not packed Location label', () => {
		const html = renderCard([...defaultVisible, 'contactNames']);
		expect(html).toContain('Contacts');
		expect(html).toContain('Alice');
	});

	it('renders custom field as labeled row', () => {
		const html = renderCard([
			...defaultVisible,
			customFieldColumnId(1),
		]);
		expect(html).toContain('Equipment');
		expect(html).toContain('Forklift');
	});

	it('gates description block on description column', () => {
		const withDesc = renderCard([...defaultVisible, 'description']);
		expect(withDesc).toContain('task-card-description');
		expect(withDesc).toContain('Bring photo');

		const without = renderCard(defaultVisible);
		expect(without).not.toContain('task-card-description');
	});

	it('shows status badge even when status column is off', () => {
		const html = renderCard(['externalKey', 'taskType']);
		expect(html).toContain('Assigned');
	});

	it('omits rows with missing values instead of em dash placeholders', () => {
		const sparse: Task = {
			...baseTask,
			jobTitle: '',
			destinationAddress: '',
			windowStartAt: null,
			windowEndAt: null,
			crewName: '',
			contactNames: '',
			customFields: {},
		};
		const html = renderCard(
			[
				'externalKey',
				'taskType',
				'jobTitle',
				'destinationAddress',
				'windowStartAt',
				'windowEndAt',
				'crewName',
				'contactNames',
				customFieldColumnId(1),
			],
			sparse,
		);
		expect(html).not.toContain('>—<');
		expect(html).not.toContain('task-card-job-title');
		expect(html).not.toContain('Location');
		expect(html).not.toContain('Window');
		expect(html).not.toContain('Crew');
		expect(html).not.toContain('Contacts');
		expect(html).not.toContain('Equipment');
	});
});
