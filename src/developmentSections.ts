export const DEVELOPMENT_SECTIONS = [
	{ id: 'scripts', path: 'scripts', label: 'NPM scripts' },
	{
		id: 'document-templates',
		path: 'document-templates',
		label: 'Print templates',
	},
	{
		id: 'status-transitions',
		path: 'status-transitions',
		label: 'Status transitions (prototype)',
	},
	{ id: 'tests', path: 'tests', label: 'Tests' },
] as const;

export type DevelopmentSectionId =
	(typeof DEVELOPMENT_SECTIONS)[number]['id'];

export const DEVELOPMENT_BASE_PATH = '/development';

export function developmentSectionPath(sectionPath: string): string {
	return `${DEVELOPMENT_BASE_PATH}/${sectionPath}`;
}
