/**
 * Dev-only Vite middleware: DB-backed print template browser + PDF preview.
 */

import {
	invalidateOrgSettingsCache,
} from '../server/orgSettings.mjs';
import {
	listDevPrintTemplates,
	listPrintTagNames,
	loadDevPrintTemplateById,
	previewTaskPrint,
	saveDevPrintTemplateById,
	saveOrgPrintTemplate,
} from '../server/print.mjs';
import { validatePrintTemplate } from '../server/renderDocumentTemplate.mjs';

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
	res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
	res.end(JSON.stringify(body));
}

/**
 * @param {import('node:http').IncomingMessage} req
 */
function readBody(req) {
	return new Promise((resolveBody, reject) => {
		/** @type {Buffer[]} */
		const chunks = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => {
			resolveBody(Buffer.concat(chunks).toString('utf8'));
		});
		req.on('error', reject);
	});
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {(body: unknown) => Promise<unknown>} handler
 */
async function handleJson(req, res, handler) {
	try {
		const raw = await readBody(req);
		const body = raw ? JSON.parse(raw) : {};
		const result = await handler(body);
		sendJson(res, 200, result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const status =
			err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
				? err.status
				: 500;
		sendJson(res, status, { error: message });
	}
}

/**
 * @returns {import('vite').Plugin}
 */
export function documentTemplatesPlugin() {
	return {
		name: 'field-print-templates',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const rawUrl = req.url ?? '/';
				const parsed = new URL(rawUrl, 'http://vite.local');
				const { pathname, searchParams } = parsed;

				if (!pathname.startsWith('/api/dev/print-templates')) {
					next();
					return;
				}

				if (req.method === 'GET' && pathname === '/api/dev/print-templates/tags') {
					sendJson(res, 200, { tags: listPrintTagNames() });
					return;
				}

				if (req.method === 'GET' && pathname === '/api/dev/print-templates') {
					void listDevPrintTemplates({
						orgId: searchParams.get('orgId') ?? undefined,
						documentType: searchParams.get('documentType') ?? undefined,
						context: searchParams.get('context') ?? undefined,
						q: searchParams.get('q') ?? undefined,
					})
						.then((templates) => sendJson(res, 200, { templates }))
						.catch((err) => {
							const message = err instanceof Error ? err.message : String(err);
							const status =
								err &&
								typeof err === 'object' &&
								'status' in err &&
								typeof err.status === 'number'
									? err.status
									: 500;
							sendJson(res, status, { error: message });
						});
					return;
				}

				const previewMatch = /^\/api\/dev\/print-templates\/(\d+)\/preview$/.exec(
					pathname,
				);
				if (req.method === 'POST' && previewMatch) {
					const templateId = Number(previewMatch[1]);
					void handleJson(req, res, async (body) => {
						const { summary, template: storedTemplate } =
							await loadDevPrintTemplateById(templateId);

						if (storedTemplate.context === 'report') {
							throw Object.assign(new Error('Report context not implemented'), {
								status: 501,
							});
						}

						const draft =
							body && typeof body === 'object' && body.template != null
								? body.template
								: null;
						const template = draft
							? validatePrintTemplate(draft, summary.documentType)
							: storedTemplate;

						const task =
							body && typeof body === 'object' && body.task && typeof body.task === 'object'
								? body.task
								: null;
						if (!task) {
							throw Object.assign(
								new Error('task is required for task-context preview'),
								{ status: 400 },
							);
						}

						const { buffer } = await previewTaskPrint(
							summary.documentType,
							task,
							draft,
							summary.orgId,
						);
						return {
							ok: true,
							size: buffer.length,
							pdfBase64: buffer.toString('base64'),
						};
					});
					return;
				}

				const idMatch = /^\/api\/dev\/print-templates\/(\d+)$/.exec(pathname);
				if (idMatch) {
					const templateId = Number(idMatch[1]);

					if (req.method === 'GET') {
						void loadDevPrintTemplateById(templateId)
							.then(({ summary, template }) =>
								sendJson(res, 200, { summary, template }),
							)
							.catch((err) => {
								const message = err instanceof Error ? err.message : String(err);
								const status =
									err &&
									typeof err === 'object' &&
									'status' in err &&
									typeof err.status === 'number'
										? err.status
										: 500;
								sendJson(res, status, { error: message });
							});
						return;
					}

					if (req.method === 'PUT') {
						void handleJson(req, res, async (body) => {
							const template =
								body && typeof body === 'object' && body.template != null
									? body.template
									: body;
							const name =
								body &&
								typeof body === 'object' &&
								typeof body.name === 'string'
									? body.name
									: undefined;
							const saved = await saveDevPrintTemplateById(
								templateId,
								template,
								name,
							);
							invalidateOrgSettingsCache();
							return saved;
						});
						return;
					}
				}

				if (req.method === 'POST' && pathname === '/api/dev/print-templates') {
					void handleJson(req, res, async (body) => {
						if (!body || typeof body !== 'object') {
							throw Object.assign(new Error('Request body is required'), {
								status: 400,
							});
						}
						const orgId = Number(body.orgId ?? 1);
						const documentType =
							typeof body.documentType === 'string'
								? body.documentType.trim()
								: '';
						const template = body.template;
						const name =
							typeof body.name === 'string' ? body.name.trim() : undefined;
						if (!documentType) {
							throw Object.assign(new Error('documentType is required'), {
								status: 400,
							});
						}
						const saved = await saveOrgPrintTemplate(
							orgId,
							documentType,
							template,
							name,
						);
						invalidateOrgSettingsCache();
						return saved;
					});
					return;
				}

				sendJson(res, 405, { error: 'Method not allowed' });
			});
		},
	};
}
