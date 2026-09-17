import { getDemoStore } from '../store';
import { jsonResponse } from '../response';

export function handleGetOrgSettings(): Response {
	const { orgSettings } = getDemoStore();
	return jsonResponse(orgSettings);
}

export function handleGetOrgPrintTemplates(): Response {
	const { printTemplates } = getDemoStore();
	return jsonResponse(printTemplates);
}
