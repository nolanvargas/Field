/**

 * Context-agnostic print engine — load org templates from DB, resolve context, render PDFs.

 * File-based loaders remain for dev Vite middleware only.

 */



import { listDocumentTypes } from '../shared/documentTypes.js';

import { invalidateOrgSettingsCache } from './orgSettings.mjs';

import {

	computePrintTemplateContentHash,

	getOrgPrintTemplatesPayload,

	isOrgPrintConfigured,

	listDevPrintTemplates,

	listOrgPrintTemplates,

	loadDevPrintTemplateById,

	loadOrgPrintTemplate,

	saveDevPrintTemplateById,

	saveOrgPrintTemplate as saveOrgPrintTemplateRow,

} from './orgPrintTemplates.mjs';

import {

	resolveReportPrint,

} from './printContexts/report.mjs';

import {

	listTaskPrintTagNames,

	renderTaskPrintTemplate,

	resolveTaskPrint,

} from './printContexts/task.mjs';

import {

	validatePrintTemplate,

} from './renderDocumentTemplate.mjs';

import {

	CURRENT_PRINT_STORAGE_PREFIX,

	printFileName,

	printStorageKey,

	printStorageKind,

} from './printStorage.mjs';



export {

	CURRENT_PRINT_STORAGE_PREFIX,

	printFileName,

	printStorageKey,

	printStorageKind,

	listDocumentTypes,

	computePrintTemplateContentHash,

	getOrgPrintTemplatesPayload,

	loadOrgPrintTemplate,

	listOrgPrintTemplates,

	listDevPrintTemplates,

	loadDevPrintTemplateById,

	saveDevPrintTemplateById,

};



const DEFAULT_ORG_ID = 1;



export async function isPrintConfigured(orgId = DEFAULT_ORG_ID) {

	return isOrgPrintConfigured(orgId);

}



export function listPrintTagNames() {

	return listTaskPrintTagNames();

}



/**

 * @param {string} documentType

 * @param {Record<string, unknown>} contextPayload

 * @param {{ orgId?: number, getTask?: (id: number) => Promise<Record<string, unknown> | null>, generatedByUserId?: string | null, persist?: boolean, task?: Record<string, unknown> }} [opts]

 */

export async function renderPrint(documentType, contextPayload, opts = {}) {

	const orgId = opts.orgId ?? DEFAULT_ORG_ID;

	const { template } = await loadOrgPrintTemplate(orgId, documentType);

	const context =

		contextPayload && typeof contextPayload.context === 'string'

			? contextPayload.context.trim()

			: '';



	if (!context) {

		throw Object.assign(new Error('context is required'), { status: 400 });

	}

	if (context !== template.context) {

		throw Object.assign(

			new Error(

				`Document type "${documentType}" uses context "${template.context}", not "${context}"`,

			),

			{ status: 400 },

		);

	}



	if (context === 'task') {

		const taskId = Number(contextPayload.taskId);

		let task = opts.task ?? null;

		if (!task) {

			if (!Number.isFinite(taskId)) {

				throw Object.assign(new Error('taskId is required'), { status: 400 });

			}

			if (!opts.getTask) {

				throw Object.assign(new Error('Task loader is not configured'), {

					status: 500,

				});

			}

			task = await opts.getTask(taskId);

			if (!task) {

				throw Object.assign(new Error('Task not found'), { status: 404 });

			}

		}



		const persist = opts.persist ?? template.persist === true;

		return resolveTaskPrint(documentType, template, task, {

			persist,

			generatedByUserId: opts.generatedByUserId,

		});

	}



	if (context === 'report') {

		return resolveReportPrint(contextPayload);

	}



	throw Object.assign(new Error(`Unknown print context: ${context}`), {

		status: 400,

	});

}



/**

 * @param {string} documentType

 * @param {Record<string, unknown>} task

 * @param {unknown} [draft]

 * @param {number} [orgId]

 */

export async function previewTaskPrint(

	documentType,

	task,

	draft = null,

	orgId = DEFAULT_ORG_ID,

) {

	const template = draft

		? validatePrintTemplate(draft, documentType)

		: (await loadOrgPrintTemplate(orgId, documentType)).template;

	if (template.context !== 'task') {

		throw Object.assign(

			new Error('Task fixture preview requires a task-context template'),

			{ status: 400 },

		);

	}

	const buffer = await renderTaskPrintTemplate(template, task);

	const taskId = Number(task.id) || 0;

	return {

		buffer,

		fileName: printFileName(documentType, taskId),

	};

}



/**

 * @param {{ context?: string, surface?: string }} [filters]

 */

export async function listPrintTemplates(filters = {}) {

	return listOrgPrintTemplates(DEFAULT_ORG_ID, filters);

}



/**

 * @param {number} orgId

 * @param {string} documentType

 * @param {unknown} parsed

 * @param {string} [name]

 */

export async function saveOrgPrintTemplate(orgId, documentType, parsed, name) {

	const result = await saveOrgPrintTemplateRow(orgId, documentType, parsed, name);

	invalidateOrgSettingsCache();

	return result;

}


