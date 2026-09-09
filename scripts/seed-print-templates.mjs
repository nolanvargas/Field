/**
 * Import JSON print template seeds into org_print_templates.
 * Run after db:schema or standalone: npm run db:seed-print-templates
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPgClient } from './lib/db.mjs';
import { isValidDocumentType } from '../shared/documentTypes.js';
import { computePrintTemplateContentHash } from '../server/orgPrintTemplates.mjs';
import { validatePrintTemplate } from '../server/renderDocumentTemplate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const seedsDir = resolve(root, 'document-templates');
const ORG_ID = 1;

/**
 * @param {string} documentType
 * @param {unknown} parsed
 */
function parseSeedTemplate(documentType, parsed) {
	const template = validatePrintTemplate(parsed, documentType);
	if (!isValidDocumentType(documentType)) {
		throw new Error(`Unknown document type: ${documentType}`);
	}
	return template;
}

/**
 * @param {import('pg').Client} client
 * @param {string} documentType
 * @param {import('../server/renderDocumentTemplate.mjs').PrintTemplateDefinition} template
 */
async function upsertTemplate(client, documentType, template) {
	const contentHash = computePrintTemplateContentHash(template);
	const surfaces = template.surfaces ?? {};
	const name =
		template.label?.trim() ||
		documentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	await client.query(
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
       updated_at = now()`,
		[
			ORG_ID,
			name,
			documentType,
			template.context,
			JSON.stringify(template),
			contentHash,
			JSON.stringify(surfaces),
			template.persist === true,
			template.requiresStatus,
			0,
		],
	);
}

const client = createPgClient();
await client.connect();

try {
	const files = (await readdir(seedsDir))
		.filter((name) => name.endsWith('.json'))
		.sort();

	let seeded = 0;
	for (const file of files) {
		const documentType = file.replace(/\.json$/, '');
		if (!isValidDocumentType(documentType)) {
			console.log(`Skip ${file} (not a registered document type)`);
			continue;
		}
		const raw = await readFile(resolve(seedsDir, file), 'utf8');
		const template = parseSeedTemplate(documentType, JSON.parse(raw));
		await upsertTemplate(client, documentType, template);
		console.log(`Seeded org ${ORG_ID} template: ${documentType}`);
		seeded += 1;
	}

	console.log(`Done. Seeded ${seeded} print template(s).`);
} finally {
	await client.end();
}
