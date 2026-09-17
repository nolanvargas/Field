import { handleGetAuthConfig } from './handlers/auth';
import { handleGetOrgPrintTemplates, handleGetOrgSettings } from './handlers/org';
import {
	handleAttachmentDownloadUrl,
	handleListAttachments,
} from './handlers/attachments';
import { handleGetTaskHistory } from './handlers/history';
import { handleGetTaskById, handleGetTasks } from './handlers/tasks';
import { handleGetUsers } from './handlers/users';
import { errorResponse } from './response';

function parseRequestPath(path: string): { pathname: string; searchParams: URLSearchParams } {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	const url = new URL(normalized, 'http://field.demo');
	return { pathname: url.pathname, searchParams: url.searchParams };
}

/**
 * Mock API for demo builds. `path` is `/api/...` optionally with query string.
 */
export async function demoRouter(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	const method = (init?.method ?? 'GET').toUpperCase();
	const { pathname, searchParams } = parseRequestPath(path);

	if (method === 'GET' && pathname === '/api/auth/config') {
		return handleGetAuthConfig();
	}
	if (method === 'GET' && pathname === '/api/users') {
		return handleGetUsers(searchParams);
	}
	if (method === 'GET' && pathname === '/api/org/settings') {
		return handleGetOrgSettings();
	}
	if (method === 'GET' && pathname === '/api/org/print-templates') {
		return handleGetOrgPrintTemplates();
	}
	if (method === 'GET' && pathname === '/api/tasks') {
		return handleGetTasks(searchParams);
	}
	const taskById = pathname.match(/^\/api\/tasks\/(\d+)$/);
	if (method === 'GET' && taskById) {
		return handleGetTaskById(Number(taskById[1]));
	}
	const taskHistory = pathname.match(/^\/api\/tasks\/(\d+)\/history$/);
	if (method === 'GET' && taskHistory) {
		return handleGetTaskHistory(Number(taskHistory[1]));
	}
	const attachmentsList = pathname.match(/^\/api\/tasks\/(\d+)\/attachments$/);
	if (method === 'GET' && attachmentsList) {
		return handleListAttachments(Number(attachmentsList[1]));
	}
	const attachmentUrl = pathname.match(
		/^\/api\/tasks\/(\d+)\/attachments\/(\d+)\/url$/,
	);
	if (method === 'GET' && attachmentUrl) {
		const inline = searchParams.get('inline') === '1';
		return handleAttachmentDownloadUrl(
			Number(attachmentUrl[1]),
			Number(attachmentUrl[2]),
			inline,
		);
	}

	return errorResponse('Not available in demo', 501);
}
