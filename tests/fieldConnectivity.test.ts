import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('fieldConnectivity', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reports offline when navigator is offline', async () => {
		vi.stubGlobal('navigator', { onLine: false });
		const { getFieldConnectivity, startFieldConnectivity } = await import(
			'../src/connectivity/fieldConnectivity'
		);
		startFieldConnectivity();
		expect(getFieldConnectivity().issue).toBe('offline');
	});

	it('reports unreachable after a network fetch failure', async () => {
		vi.stubGlobal('navigator', { onLine: true });
		const {
			getFieldConnectivity,
			reportNetworkFetchFailure,
			reportNetworkFetchSuccess,
			startFieldConnectivity,
		} = await import('../src/connectivity/fieldConnectivity');
		startFieldConnectivity();
		expect(getFieldConnectivity().issue).toBeNull();
		reportNetworkFetchFailure();
		expect(getFieldConnectivity().issue).toBe('unreachable');
		reportNetworkFetchSuccess();
		expect(getFieldConnectivity().issue).toBeNull();
	});

	it('classifies fetch errors but not aborts', async () => {
		const { isNetworkFetchError } = await import(
			'../src/connectivity/fieldConnectivity'
		);
		expect(isNetworkFetchError(new Error('Failed to fetch'))).toBe(true);
		const abort = new DOMException('Aborted', 'AbortError');
		expect(isNetworkFetchError(abort)).toBe(false);
	});
});
