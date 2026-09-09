/**

 * Org-configurable tracking page templates (ordered block list, v2).

 * Stored per org_task_types row; null in DB resolves to built-in default.

 */



import { defaultTrackingPageDocumentKinds } from './documentTypes.js';



/**

 * @typedef {'text' | 'spacer' | 'detailRows' | 'documents' | 'history' | 'imageAttachments'} TrackingPageBlockType

 */



/**

 * @typedef {{

 *   id: string,

 *   type: 'text',

 *   html: string,

 * }} TrackingPageTextBlock

 */



/**

 * @typedef {{

 *   id: string,

 *   type: 'spacer',

 *   size: 'sm' | 'md' | 'lg',

 * }} TrackingPageSpacerBlock

 */



/**

 * @typedef {{

 *   id: string,

 *   type: 'detailRows',

 *   rows: { label: string, tag: string }[],

 * }} TrackingPageDetailRowsBlock

 */



/**

 * @typedef {{

 *   id: string,

 *   type: 'documents',

 *   kinds: string[],

 * }} TrackingPageDocumentsBlock

 */



/**

 * @typedef {{ id: string, type: 'history' }} TrackingPageHistoryBlock

 */



/**

 * @typedef {{ id: string, type: 'imageAttachments' }} TrackingPageImageAttachmentsBlock

 */



/** @typedef {TrackingPageTextBlock | TrackingPageSpacerBlock | TrackingPageDetailRowsBlock | TrackingPageDocumentsBlock | TrackingPageHistoryBlock | TrackingPageImageAttachmentsBlock} TrackingPageBlock */



/**

 * @typedef {{

 *   version: 2,

 *   blocks: TrackingPageBlock[],

 * }} TrackingPageTemplate

 */



export const TRACKING_PAGE_TEMPLATE_VERSION = 2;



/** @type {readonly TrackingPageBlockType[]} */

export const TRACKING_PAGE_BLOCK_TYPES = Object.freeze([

	'text',

	'spacer',

	'detailRows',

	'documents',

	'history',

	'imageAttachments',

]);



/** @type {Record<TrackingPageBlockType, string>} */

export const TRACKING_PAGE_BLOCK_LABELS = Object.freeze({

	text: 'Text',

	spacer: 'Spacer',

	detailRows: 'Detail rows',

	documents: 'Documents',

	history: 'History',

	imageAttachments: 'Completion images',

});



/** @type {readonly TrackingPageBlockType[]} */

export const TRACKING_PAGE_SINGLETON_BLOCK_TYPES = Object.freeze([

	'documents',

	'history',

	'imageAttachments',

]);



/** @type {readonly string[]} */

export const TRACKING_PAGE_MERGE_TAGS = Object.freeze([

	'task.headline',

	'task.job_title',

	'task.status',

	'task.task_type',

	'task.destination_name',

	'task.completed_at',

	'task.external_key',

	'task.contact_name',

	'company.name',

]);



const BLOCK_SET = new Set(TRACKING_PAGE_BLOCK_TYPES);

const SPACER_SIZES = new Set(['sm', 'md', 'lg']);



/**

 * @param {unknown} value

 * @returns {string}

 */

function asString(value) {

	if (value == null) return '';

	return String(value).trim();

}



/**

 * @param {unknown} raw

 */

function normalizeDetailRows(raw) {

	if (!Array.isArray(raw)) return [];

	/** @type {{ label: string, tag: string }[]} */

	const out = [];

	for (const item of raw) {

		if (!item || typeof item !== 'object') continue;

		const label = asString(/** @type {{ label?: unknown }} */ (item).label);

		const tag = asString(/** @type {{ tag?: unknown }} */ (item).tag);

		if (!label || !tag) continue;

		out.push({ label, tag });

	}

	return out;

}



/**

 * @param {unknown} raw

 */

function normalizeDocumentKinds(raw) {

	if (!Array.isArray(raw)) return [];

	return raw.map((k) => asString(k)).filter(Boolean);

}



/**

 * @param {unknown} raw

 * @param {number} index

 * @returns {TrackingPageBlock}

 */

function normalizeBlock(raw, index) {

	if (!raw || typeof raw !== 'object') {

		throw new Error(`Block ${index + 1} is invalid`);

	}

	const row = /** @type {Record<string, unknown>} */ (raw);

	const id = asString(row.id) || `block-${index + 1}`;

	const type = asString(row.type);



	if (!BLOCK_SET.has(/** @type {TrackingPageBlockType} */ (type))) {

		throw new Error(`Block "${id}" has invalid type: ${type}`);

	}



	switch (type) {

		case 'text':

			return {

				id,

				type: 'text',

				html: typeof row.html === 'string' ? row.html : '',

			};

		case 'spacer': {

			const size = asString(row.size);

			return {

				id,

				type: 'spacer',

				size: SPACER_SIZES.has(size) ? /** @type {'sm' | 'md' | 'lg'} */ (size) : 'md',

			};

		}

		case 'detailRows':

			return {

				id,

				type: 'detailRows',

				rows: normalizeDetailRows(row.rows),

			};

		case 'documents':

			return {

				id,

				type: 'documents',

				kinds: normalizeDocumentKinds(row.kinds),

			};

		case 'history':

			return { id, type: 'history' };

		case 'imageAttachments':

			return { id, type: 'imageAttachments' };

		default:

			throw new Error(`Block "${id}" has invalid type: ${type}`);

	}

}



/**

 * @param {string} taskTypeName

 * @returns {{ label: string, tag: string }[]}

 */

function defaultDetailRows(taskTypeName) {

	const isDelivery = taskTypeName === 'Delivery';

	const rows = [

		{ label: isDelivery ? 'Order' : 'Job', tag: 'task.job_title' },

	];

	if (!isDelivery) {

		rows.push({ label: 'Type', tag: 'task.task_type' });

	}

	rows.push({

		label: isDelivery ? 'Delivered to' : 'Location',

		tag: 'task.destination_name',

	});

	rows.push({ label: 'Status', tag: 'task.status' });

	rows.push({ label: 'Completed', tag: 'task.completed_at' });

	return rows;

}



/**

 * @param {string} taskTypeName

 * @returns {TrackingPageTemplate}

 */

export function defaultTrackingPageTemplate(taskTypeName) {

	const documentKinds = defaultTrackingPageDocumentKinds(taskTypeName);



	return {

		version: TRACKING_PAGE_TEMPLATE_VERSION,

		blocks: [

			{

				id: 'headline',

				type: 'text',

				html: '<h1>{{task.headline}}</h1>',

			},

			{

				id: 'details',

				type: 'detailRows',

				rows: defaultDetailRows(taskTypeName),

			},

			{

				id: 'docs',

				type: 'documents',

				kinds: documentKinds,

			},

			{

				id: 'timeline',

				type: 'history',

			},

		],

	};

}



/**

 * @param {unknown} raw

 * @param {string} [taskTypeName]

 * @returns {TrackingPageTemplate}

 */

export function normalizeTrackingPageTemplate(raw, taskTypeName = 'Delivery') {

	if (raw == null) {

		return defaultTrackingPageTemplate(taskTypeName);

	}

	if (typeof raw !== 'object' || Array.isArray(raw)) {

		throw new Error('trackingPageTemplate must be an object');

	}

	const row = /** @type {Record<string, unknown>} */ (raw);

	const version = Number(row.version);

	if (version !== TRACKING_PAGE_TEMPLATE_VERSION) {

		throw new Error(`trackingPageTemplate version must be ${TRACKING_PAGE_TEMPLATE_VERSION}`);

	}



	if (!Array.isArray(row.blocks)) {

		throw new Error('trackingPageTemplate.blocks must be an array');

	}



	const blocks = row.blocks.map((b, i) => normalizeBlock(b, i));

	const seenIds = new Set();

	const seenSingletonTypes = new Set();

	for (const block of blocks) {

		if (seenIds.has(block.id)) {

			throw new Error(`Duplicate block id: ${block.id}`);

		}

		seenIds.add(block.id);

		if (TRACKING_PAGE_SINGLETON_BLOCK_TYPES.includes(block.type)) {

			if (seenSingletonTypes.has(block.type)) {

				const label = TRACKING_PAGE_BLOCK_LABELS[block.type];

				throw new Error(`Duplicate ${label} block`);

			}

			seenSingletonTypes.add(block.type);

		}

	}



	return {

		version: TRACKING_PAGE_TEMPLATE_VERSION,

		blocks,

	};

}



/**

 * Resolve DB null to default; validate stored JSON.

 * @param {unknown} dbValue

 * @param {string} taskTypeName

 * @returns {TrackingPageTemplate}

 */

export function trackingPageTemplateFromDb(dbValue, taskTypeName) {

	if (dbValue == null) {

		return defaultTrackingPageTemplate(taskTypeName);

	}

	return normalizeTrackingPageTemplate(dbValue, taskTypeName);

}



/**

 * Stable JSON for equality checks.

 * @param {unknown} template

 * @param {string} [taskTypeName]

 */

export function snapshotTrackingPageTemplate(template, taskTypeName = 'Delivery') {

	return JSON.stringify(normalizeTrackingPageTemplate(template, taskTypeName));

}



/**

 * @param {TrackingPageBlockType} blockType

 * @param {string} [taskTypeName]

 */

export function defaultBlock(blockType, taskTypeName = 'Delivery') {

	const id = newBlockId(blockType);

	switch (blockType) {

		case 'text':

			return { id, type: 'text', html: '<p></p>' };

		case 'spacer':

			return { id, type: 'spacer', size: 'md' };

		case 'detailRows':

			return { id, type: 'detailRows', rows: defaultDetailRows(taskTypeName) };

		case 'documents':

			return {

				id,

				type: 'documents',

				kinds: defaultTrackingPageDocumentKinds(taskTypeName),

			};

		case 'history':

			return { id, type: 'history' };

		case 'imageAttachments':

			return { id, type: 'imageAttachments' };

		default:

			throw new Error(`Unknown block type: ${blockType}`);

	}

}



/**

 * Replace `{{tag}}` merge tags in HTML. Unknown tags are left intact.

 * @param {string} html

 * @param {Record<string, string>} tagMap

 */

export function substituteMergeTags(html, tagMap) {

	if (!html) return '';

	return html.replace(/\{\{([^{}]+)\}\}/g, (match, tag) => {

		const key = String(tag).trim();

		if (Object.prototype.hasOwnProperty.call(tagMap, key)) {

			return tagMap[key] ?? '';

		}

		return match;

	});

}



/**

 * @param {string} [prefix]

 */

export function newBlockId(prefix = 'block') {

	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

}



/**

 * Whether another block of this type may be added to the template.

 * @param {TrackingPageBlockType} blockType

 * @param {TrackingPageBlock[]} blocks

 */

export function canAddTrackingPageBlockType(blockType, blocks) {

	if (!TRACKING_PAGE_SINGLETON_BLOCK_TYPES.includes(blockType)) {

		return true;

	}

	return !blocks.some((block) => block.type === blockType);

}


