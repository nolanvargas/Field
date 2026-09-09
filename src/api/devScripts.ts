import { apiFetch, apiUrl, expectOk } from './client';

export type NpmScriptsMap = Record<string, string>;
export type NpmScriptDescriptionsMap = Record<string, string>;

export type NpmScriptsPayload = {
	scripts: NpmScriptsMap;
	descriptions: NpmScriptDescriptionsMap;
};

export async function listNpmScripts(
	signal?: AbortSignal,
): Promise<NpmScriptsPayload> {
	const res = await apiFetch('/api/dev/npm-scripts', { signal });
	const data = await expectOk<NpmScriptsPayload>(
		res,
		'Failed to list npm scripts',
	);
	return {
		scripts: data.scripts ?? {},
		descriptions: data.descriptions ?? {},
	};
}

export async function saveNpmScript(
	name: string,
	command: string,
	description?: string,
): Promise<NpmScriptsPayload> {
	const res = await apiFetch('/api/dev/npm-scripts', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, command, description }),
	});
	const data = await expectOk<NpmScriptsPayload>(res, 'Failed to save script');
	return {
		scripts: data.scripts ?? {},
		descriptions: data.descriptions ?? {},
	};
}

export async function deleteNpmScript(name: string): Promise<NpmScriptsPayload> {
	const res = await apiFetch('/api/dev/npm-scripts', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name }),
	});
	const data = await expectOk<NpmScriptsPayload>(
		res,
		'Failed to delete script',
	);
	return {
		scripts: data.scripts ?? {},
		descriptions: data.descriptions ?? {},
	};
}

export async function runNpmScript(options: {
	name?: string;
	command?: string;
}): Promise<{ runId: string }> {
	const res = await apiFetch('/api/dev/npm-scripts/run', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(options),
	});
	return expectOk(res, 'Failed to start script');
}

export async function stopNpmScriptRun(runId: string): Promise<void> {
	const res = await apiFetch(`/api/dev/npm-scripts/runs/${runId}/stop`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: '{}',
	});
	await expectOk(res, 'Failed to stop script');
}

export function npmScriptRunStreamUrl(runId: string): string {
	return apiUrl(`/api/dev/npm-scripts/runs/${runId}/stream`);
}
