import { apiFetch, expectOk } from './client';
import type { DevTestLinksConfig } from '../devTestsFileLink';

export type DevTestCase = {
	id: string;
	file: string;
	edgeCase: string;
	line: number | null;
	asserts: string;
};

export type DevTestCatalog = {
	tests: DevTestCase[];
	links?: DevTestLinksConfig;
};

export async function listDevTests(options?: {
	refresh?: boolean;
	signal?: AbortSignal;
}): Promise<DevTestCatalog> {
	const query = options?.refresh ? '?refresh=1' : '';
	const res = await apiFetch(`/api/dev/tests${query}`, {
		signal: options?.signal,
	});
	const data = await expectOk<{
		tests: DevTestCase[];
		links?: DevTestLinksConfig;
	}>(res, 'Failed to list tests');
	return {
		tests: Array.isArray(data.tests)
			? data.tests.map((test) => ({
					...test,
					edgeCase: test.edgeCase ?? '',
					asserts: test.asserts ?? '',
				}))
			: [],
		links: data.links,
	};
}
