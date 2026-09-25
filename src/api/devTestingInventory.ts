import { apiFetch, expectOk } from './client';
import type { DevTestLinksConfig } from '../devTestsFileLink';

export type TestingInventoryFile = { path: string };

export type TestingInventory = {
	integration: TestingInventoryFile[];
	e2e: TestingInventoryFile[];
	links?: DevTestLinksConfig;
};

export async function fetchTestingInventory(
	signal?: AbortSignal,
): Promise<TestingInventory> {
	const res = await apiFetch('/api/dev/testing-inventory', { signal });
	const data = await expectOk<TestingInventory>(
		res,
		'Failed to load testing inventory',
	);
	return {
		integration: Array.isArray(data.integration) ? data.integration : [],
		e2e: Array.isArray(data.e2e) ? data.e2e : [],
		links: data.links,
	};
}
