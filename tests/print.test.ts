/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const printMocks = vi.hoisted(() => ({
	loadOrgPrintTemplate: vi.fn(),
	resolveTaskPrint: vi.fn(),
	resolveReportPrint: vi.fn(),
}));

vi.mock('../server/orgPrintTemplates.mjs', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../server/orgPrintTemplates.mjs')>();
	return {
		...actual,
		loadOrgPrintTemplate: printMocks.loadOrgPrintTemplate,
	};
});

vi.mock('../server/printContexts/task.mjs', () => ({
	resolveTaskPrint: printMocks.resolveTaskPrint,
	listTaskPrintTagNames: () => ['taskDesc'],
	renderTaskPrintTemplate: vi.fn(),
}));

vi.mock('../server/printContexts/report.mjs', () => ({
	resolveReportPrint: printMocks.resolveReportPrint,
}));

import { renderPrint } from '../server/print.mjs';

const taskTemplate = {
	context: 'task',
	persist: false,
	label: 'POD',
	surfaces: {},
	requiresStatus: null,
	page: 'letter',
	margin: 50,
	blocks: [],
};

describe('renderPrint', () => {
	beforeEach(() => {
		printMocks.loadOrgPrintTemplate.mockReset();
		printMocks.resolveTaskPrint.mockReset();
		printMocks.resolveReportPrint.mockReset();
	});

	it('requires context in the payload', async () => {
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: taskTemplate,
		});

		await expect(renderPrint('pod', {}, {})).rejects.toMatchObject({
			message: 'context is required',
			status: 400,
		});
	});

	it('rejects when payload context does not match the template', async () => {
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: { ...taskTemplate, context: 'task' },
		});

		await expect(
			renderPrint('pod', { context: 'report', reportKey: 'x' }, {}),
		).rejects.toMatchObject({
			message: 'Document type "pod" uses context "task", not "report"',
			status: 400,
		});
	});

	it('routes task context through resolveTaskPrint', async () => {
		const task = { id: 12, status: 'Completed' };
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: taskTemplate,
		});
		printMocks.resolveTaskPrint.mockResolvedValue({ buffer: Buffer.from('pdf') });

		const result = await renderPrint(
			'pod',
			{ context: 'task', taskId: 12 },
			{ task },
		);

		expect(printMocks.resolveTaskPrint).toHaveBeenCalledWith(
			'pod',
			taskTemplate,
			task,
			{ persist: false, generatedByUserId: undefined },
		);
		expect(result).toEqual({ buffer: Buffer.from('pdf') });
	});

	it('requires taskId or opts.task for task context', async () => {
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: taskTemplate,
		});

		await expect(
			renderPrint('pod', { context: 'task' }, {}),
		).rejects.toMatchObject({
			message: 'taskId is required',
			status: 400,
		});
	});

	it('routes report context through resolveReportPrint', async () => {
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: { ...taskTemplate, context: 'report' },
		});
		printMocks.resolveReportPrint.mockResolvedValue({ status: 'queued' });

		const result = await renderPrint(
			'weekly_summary',
			{ context: 'report', reportKey: 'crew-hours' },
			{},
		);

		expect(printMocks.resolveReportPrint).toHaveBeenCalledWith({
			context: 'report',
			reportKey: 'crew-hours',
		});
		expect(result).toEqual({ status: 'queued' });
	});

	it('rejects unknown print contexts', async () => {
		printMocks.loadOrgPrintTemplate.mockResolvedValue({
			template: { ...taskTemplate, context: 'invoice' },
		});

		await expect(
			renderPrint('custom', { context: 'invoice' }, {}),
		).rejects.toMatchObject({
			message: 'Unknown print context: invoice',
			status: 400,
		});
	});
});
