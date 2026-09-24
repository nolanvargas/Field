export const TESTING_HUB_SECTIONS = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'run', label: 'Run automated tests' },
	{ id: 'vitest-catalog', label: 'Vitest catalog' },
	{ id: 'integration-e2e', label: 'Integration & E2E' },
	{ id: 'testing-strategy', label: 'Testing strategy' },
	{ id: 'manual-qa', label: 'Manual QA' },
	{ id: 'pilot-uat', label: 'Pilot UAT' },
] as const;

export type TestingHubSectionId =
	(typeof TESTING_HUB_SECTIONS)[number]['id'];

/** Map markdown doc filenames to in-page section anchors */
export const MARKDOWN_DOC_HREF_TO_SECTION: Record<string, TestingHubSectionId> =
	{
		'testing-strategy.md': 'testing-strategy',
		'manual-test-overview.md': 'manual-qa',
		'pilot-uat-script.md': 'pilot-uat',
	};

export const TEST_NPM_SCRIPTS = [
	'test',
	'test:coverage',
	'test:watch',
	'test:integration',
	'test:e2e',
	'test:e2e:ui',
] as const;
