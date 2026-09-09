export type DevTestLinksConfig = {
	workspaceRoot: string;
	urlScheme: string;
};

export function buildDevTestFileHref(
	links: DevTestLinksConfig | null | undefined,
	file: string,
	line: number | null,
): string | null {
	if (!links?.workspaceRoot || line == null || !file) return null;
	const root = links.workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
	const path = `${root}/${file}`.replace(/\/+/g, '/');
	const scheme = links.urlScheme?.trim() || 'vscode';
	return `${scheme}://file/${path}:${line}`;
}

export function devTestFileLabel(file: string, line: number | null): string {
	const base = file.replace(/^tests\//, '');
	return line == null ? base : `${base}:${line}`;
}
