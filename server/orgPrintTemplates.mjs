/**

 * DB access for org_print_templates — shared by print engine and org settings.

 */



import { createHash } from 'node:crypto';

import { getDocumentType, isValidDocumentType } from '../shared/documentTypes.js';

import { getPool } from './db.mjs';

import { validatePrintTemplate } from './renderDocumentTemplate.mjs';



const DEFAULT_ORG_ID = 1;



/**

 * @param {import('./renderDocumentTemplate.mjs').PrintTemplateDefinition} template

 */

export function computePrintTemplateContentHash(template) {

	return createHash('sha256')

		.update(JSON.stringify(template))

		.digest('hex');

}



/**

 * @param {import('pg').QueryResultRow} row

 */

export function rowToPrintTemplate(row) {

	const body =

		row.template && typeof row.template === 'object'

			? row.template

			: JSON.parse(String(row.template ?? '{}'));

	const validated = validatePrintTemplate(body, String(row.document_type));

	const surfaces =

		row.surfaces && typeof row.surfaces === 'object' && !Array.isArray(row.surfaces)

			? /** @type {Record<string, boolean>} */ (row.surfaces)

			: validated.surfaces;

	return {

		...validated,

		context: String(row.context ?? validated.context),

		surfaces,

		persist: row.persist != null ? Boolean(row.persist) : validated.persist,

		requiresStatus:

			row.requires_status != null

				? String(row.requires_status)

				: validated.requiresStatus,

	};

}



/**

 * @param {number} orgId

 */

export async function computeOrgPrintTemplatesRevision(orgId = DEFAULT_ORG_ID) {

	const pool = getPool();

	const { rows } = await pool.query(

		`SELECT document_type, content_hash

     FROM org_print_templates

     WHERE org_id = $1

     ORDER BY document_type ASC`,

		[orgId],

	);

	const pairs = rows

		.map((row) => `${row.document_type}:${row.content_hash}`)

		.join('|');

	return createHash('sha256').update(pairs).digest('hex');

}



/**

 * @param {number} orgId

 * @param {string} documentType

 */

export async function loadOrgPrintTemplate(orgId, documentType) {

	const typeKey = String(documentType ?? '').trim();

	if (!typeKey) {

		throw Object.assign(new Error('Document type is required'), { status: 400 });

	}

	if (!isValidDocumentType(typeKey)) {

		throw Object.assign(new Error(`Unknown document type: ${typeKey}`), {

			status: 404,

		});

	}



	const pool = getPool();

	const { rows } = await pool.query(

		`SELECT id, org_id, name, document_type, context, template, content_hash,

            surfaces, persist, requires_status, sort_order, updated_at

     FROM org_print_templates

     WHERE org_id = $1 AND document_type = $2`,

		[orgId, typeKey],

	);

	const row = rows[0];

	if (!row) {

		throw Object.assign(

			new Error(`No print template configured for document type: ${typeKey}`),

			{ status: 404 },

		);

	}



	return {

		row,

		template: rowToPrintTemplate(row),

	};

}



/**

 * @param {number} orgId

 * @param {{ context?: string, surface?: string, includeTemplate?: boolean }} [filters]

 */

export async function listOrgPrintTemplates(orgId = DEFAULT_ORG_ID, filters = {}) {

	const contextFilter =

		typeof filters.context === 'string' ? filters.context.trim() : '';

	const surfaceFilter =

		typeof filters.surface === 'string' ? filters.surface.trim() : '';

	const includeTemplate = filters.includeTemplate === true;



	const pool = getPool();

	const { rows } = await pool.query(

		`SELECT id, org_id, name, document_type, context, template, content_hash,

            surfaces, persist, requires_status, sort_order, updated_at

     FROM org_print_templates

     WHERE org_id = $1

     ORDER BY sort_order ASC, document_type ASC`,

		[orgId],

	);



	/** @type {Record<string, unknown>[]} */

	const templates = [];

	for (const row of rows) {

		const docType = getDocumentType(row.document_type);

		if (!docType) continue;



		const templateBody = rowToPrintTemplate(row);

		if (contextFilter && templateBody.context !== contextFilter) continue;



		const surfaces = templateBody.surfaces ?? {};

		if (surfaceFilter === 'taskMenu' && !surfaces.taskMenu) continue;



		/** @type {Record<string, unknown>} */

		const entry = {

			documentType: row.document_type,

			label: docType.label,

			menuGroup: docType.menuGroup ?? null,

			context: templateBody.context,

			surfaces,

			persist: templateBody.persist,

			requiresStatus: templateBody.requiresStatus,

			sortOrder: Number(row.sort_order ?? 0),

			hash: String(row.content_hash),

			name: String(row.name),

		};

		if (includeTemplate) {

			entry.template = templateBody;

		}

		templates.push(entry);

	}

	return templates;

}



/**

 * @param {number} orgId

 */

export async function getOrgPrintTemplatesPayload(orgId = DEFAULT_ORG_ID) {

	const revision = await computeOrgPrintTemplatesRevision(orgId);

	const templates = await listOrgPrintTemplates(orgId, { includeTemplate: true });

	return { revision, templates };

}



/**

 * @param {number} orgId

 */

export async function isOrgPrintConfigured(orgId = DEFAULT_ORG_ID) {

	const templates = await listOrgPrintTemplates(orgId, {

		context: 'task',

		surface: 'taskMenu',

	});

	return templates.length > 0;

}



/**

 * @param {number} orgId

 * @param {string} documentType

 * @param {unknown} parsed

 * @param {string} [name]

 */

export async function saveOrgPrintTemplate(orgId, documentType, parsed, name) {

	const typeKey = String(documentType ?? '').trim();

	if (!isValidDocumentType(typeKey)) {

		throw Object.assign(new Error(`Unknown document type: ${typeKey}`), {

			status: 400,

		});

	}

	const template = validatePrintTemplate(parsed, typeKey);

	const contentHash = computePrintTemplateContentHash(template);

	const surfaces = template.surfaces ?? {};

	const displayName =

		typeof name === 'string' && name.trim()

			? name.trim()

			: template.label?.trim() || typeKey;



	const pool = getPool();

	const { rows } = await pool.query(

		`INSERT INTO org_print_templates (

       org_id, name, document_type, context, template, content_hash,

       surfaces, persist, requires_status, sort_order, updated_at

     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9, $10, now())

     ON CONFLICT (org_id, document_type) DO UPDATE SET

       name = EXCLUDED.name,

       context = EXCLUDED.context,

       template = EXCLUDED.template,

       content_hash = EXCLUDED.content_hash,

       surfaces = EXCLUDED.surfaces,

       persist = EXCLUDED.persist,

       requires_status = EXCLUDED.requires_status,

       sort_order = EXCLUDED.sort_order,

       updated_at = now()

     RETURNING id`,

		[

			orgId,

			displayName,

			typeKey,

			template.context,

			JSON.stringify(template),

			contentHash,

			JSON.stringify(surfaces),

			template.persist === true,

			template.requiresStatus,

			0,

		],

	);

	return {

		id: Number(rows[0].id),

		documentType: typeKey,

		template,

		contentHash,

	};

}



/**

 * @param {{ orgId?: number | string, documentType?: string, context?: string, q?: string }} [filters]

 */

export async function listDevPrintTemplates(filters = {}) {

	const orgIdRaw = filters.orgId;

	const orgId =

		orgIdRaw != null && String(orgIdRaw).trim() !== ''

			? Number(orgIdRaw)

			: null;

	if (orgId != null && (!Number.isInteger(orgId) || orgId < 1)) {

		throw Object.assign(new Error('orgId must be a positive integer'), {

			status: 400,

		});

	}



	const documentType =

		typeof filters.documentType === 'string'

			? filters.documentType.trim()

			: '';

	const context =

		typeof filters.context === 'string' ? filters.context.trim() : '';

	const q = typeof filters.q === 'string' ? filters.q.trim() : '';



	const pool = getPool();

	const conditions = ['1=1'];

	/** @type {unknown[]} */

	const params = [];



	if (orgId != null) {

		params.push(orgId);

		conditions.push(`org_id = $${params.length}`);

	}

	if (documentType) {

		if (!isValidDocumentType(documentType)) {

			throw Object.assign(new Error(`Unknown document type: ${documentType}`), {

				status: 400,

			});

		}

		params.push(documentType);

		conditions.push(`document_type = $${params.length}`);

	}

	if (context) {

		params.push(context);

		conditions.push(`context = $${params.length}`);

	}

	if (q) {

		params.push(`%${q}%`);

		conditions.push(`name ILIKE $${params.length}`);

	}



	const { rows } = await pool.query(

		`SELECT id, org_id, name, document_type, context, content_hash,

            surfaces, persist, requires_status, sort_order, updated_at

     FROM org_print_templates

     WHERE ${conditions.join(' AND ')}

     ORDER BY org_id ASC, document_type ASC, name ASC`,

		params,

	);



	return rows.map((row) => {

		const docType = getDocumentType(row.document_type);

		const surfaces =

			row.surfaces && typeof row.surfaces === 'object' && !Array.isArray(row.surfaces)

				? /** @type {Record<string, boolean>} */ (row.surfaces)

				: {};

		return {

			id: Number(row.id),

			orgId: Number(row.org_id),

			name: String(row.name),

			documentType: String(row.document_type),

			documentTypeLabel: docType?.label ?? String(row.document_type),

			context: String(row.context),

			contentHash: String(row.content_hash),

			persist: Boolean(row.persist),

			surfaces,

			requiresStatus:

				row.requires_status != null ? String(row.requires_status) : null,

			sortOrder: Number(row.sort_order ?? 0),

			updatedAt:

				row.updated_at instanceof Date

					? row.updated_at.toISOString()

					: String(row.updated_at ?? ''),

		};

	});

}



/**

 * @param {number | string} templateId

 */

export async function loadDevPrintTemplateById(templateId) {

	const id = Number(templateId);

	if (!Number.isInteger(id) || id < 1) {

		throw Object.assign(new Error('Invalid template id'), { status: 400 });

	}



	const pool = getPool();

	const { rows } = await pool.query(

		`SELECT id, org_id, name, document_type, context, template, content_hash,

            surfaces, persist, requires_status, sort_order, updated_at

     FROM org_print_templates

     WHERE id = $1`,

		[id],

	);

	const row = rows[0];

	if (!row) {

		throw Object.assign(new Error('Print template not found'), { status: 404 });

	}



	const docType = getDocumentType(row.document_type);

	return {

		row,

		template: rowToPrintTemplate(row),

		summary: {

			id: Number(row.id),

			orgId: Number(row.org_id),

			name: String(row.name),

			documentType: String(row.document_type),

			documentTypeLabel: docType?.label ?? String(row.document_type),

			context: String(row.context),

			contentHash: String(row.content_hash),

			persist: Boolean(row.persist),

			surfaces:

				row.surfaces &&

				typeof row.surfaces === 'object' &&

				!Array.isArray(row.surfaces)

					? /** @type {Record<string, boolean>} */ (row.surfaces)

					: {},

			requiresStatus:

				row.requires_status != null ? String(row.requires_status) : null,

			sortOrder: Number(row.sort_order ?? 0),

			updatedAt:

				row.updated_at instanceof Date

					? row.updated_at.toISOString()

					: String(row.updated_at ?? ''),

		},

	};

}



/**

 * @param {number | string} templateId

 * @param {unknown} parsed

 * @param {string} [name]

 */

export async function saveDevPrintTemplateById(templateId, parsed, name) {

	const { row } = await loadDevPrintTemplateById(templateId);

	return saveOrgPrintTemplate(

		Number(row.org_id),

		String(row.document_type),

		parsed,

		name,

	);

}


