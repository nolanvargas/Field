/**
 * desktopPageState unit tests (Vitest + jsdom).
 *
 * Manual QA only (not automated here):
 * - Session state clears when the browser tab closes (sessionStorage semantics)
 * - Real Safari private-mode / quota behavior if mocks diverge from device
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_STORED_DAY_FILTER,
	readPageState,
	tasksPageKey,
	usePageState,
	writePageState,
	type StoredDayFilter,
} from '../src/desktopPageState';

const PREFIX = 'field.pageState.';

type PageStateHandle<T> = {
	state: T;
	setState: (value: T | ((prev: T) => T)) => void;
};

function prefixedKey(key: string): string {
	return `${PREFIX}${key}`;
}

function PageStateProbe<T>({
	pageKey,
	fallback,
	handleRef,
}: {
	pageKey: string;
	fallback: T;
	handleRef: { current: PageStateHandle<T> | null };
}) {
	const [state, setState] = usePageState(pageKey, fallback);
	handleRef.current = { state, setState };
	return null;
}

async function mountPageStateProbe<T>(
	pageKey: string,
	fallback: T,
	container: HTMLDivElement,
	root: Root,
): Promise<{ current: PageStateHandle<T> | null }> {
	const handleRef: { current: PageStateHandle<T> | null } = { current: null };

	await act(async () => {
		root.render(
			createElement(PageStateProbe, {
				pageKey,
				fallback,
				handleRef,
			}),
		);
	});

	return handleRef;
}

describe('desktopPageState', () => {
	let container: HTMLDivElement;
	let root: Root;

	afterEach(() => {
		act(() => {
			root?.unmount();
		});
		container?.remove();
		sessionStorage.clear();
		vi.restoreAllMocks();
	});

	describe('storage contract', () => {
		it('readPageState returns fallback when prefixed key is missing', () => {
			expect(sessionStorage.getItem(prefixedKey('tasks:all:statusTab'))).toBeNull();
			expect(readPageState('tasks:all:statusTab', 'in_progress')).toBe(
				'in_progress',
			);
		});

		it('writePageState stores under the field.pageState prefix', () => {
			writePageState('tasks:all:statusTab', 'all');
			expect(sessionStorage.getItem(prefixedKey('tasks:all:statusTab'))).toBe(
				JSON.stringify('all'),
			);
		});

		it('writePageState and readPageState round-trip JSON values', () => {
			writePageState('tasks:all:statusTab', 'all');
			expect(readPageState('tasks:all:statusTab', 'in_progress')).toBe('all');
		});

		it('isolates values by logical key', () => {
			writePageState('tasks:all:statusTab', 'all');
			writePageState('tasks:mine:statusTab', 'completed');

			expect(readPageState('tasks:all:statusTab', 'in_progress')).toBe('all');
			expect(readPageState('tasks:mine:statusTab', 'in_progress')).toBe(
				'completed',
			);
		});

		it('overwrites an existing value without affecting other keys', () => {
			writePageState('tasks:all:statusTab', 'all');
			writePageState('tasks:mine:statusTab', 'completed');

			writePageState('tasks:all:statusTab', 'cancelled');

			expect(readPageState('tasks:all:statusTab', 'in_progress')).toBe(
				'cancelled',
			);
			expect(readPageState('tasks:mine:statusTab', 'in_progress')).toBe(
				'completed',
			);
		});

		it('tasksPageKey builds mode-scoped keys for all task fields', () => {
			expect(tasksPageKey('all', 'statusTab')).toBe('tasks:all:statusTab');
			expect(tasksPageKey('mine', 'dayFilter')).toBe('tasks:mine:dayFilter');
			expect(tasksPageKey('all', 'listView')).toBe('tasks:all:listView');
			expect(tasksPageKey('mine', 'focusDayKey')).toBe('tasks:mine:focusDayKey');
		});
	});

	describe('readPageState edge cases', () => {
		it('returns fallback on invalid JSON', () => {
			sessionStorage.setItem(prefixedKey('bad'), 'not-json');
			expect(readPageState('bad', 42)).toBe(42);
		});

		it('returns fallback for empty, whitespace, and truncated JSON', () => {
			sessionStorage.setItem(prefixedKey('empty'), '');
			sessionStorage.setItem(prefixedKey('whitespace'), '   ');
			sessionStorage.setItem(prefixedKey('truncated'), '{"dayFilter":');

			expect(readPageState('empty', 'fallback')).toBe('fallback');
			expect(readPageState('whitespace', 'fallback')).toBe('fallback');
			expect(readPageState('truncated', 'fallback')).toBe('fallback');
		});

		it('returns null when stored JSON is null (not the fallback)', () => {
			sessionStorage.setItem(prefixedKey('cleared'), 'null');
			expect(readPageState<string | null>('cleared', 'fallback')).toBeNull();
		});

		it('returns parsed primitives and collections as-is for caller validation', () => {
			sessionStorage.setItem(prefixedKey('number'), '123');
			sessionStorage.setItem(prefixedKey('string'), '"invalid-tab"');
			sessionStorage.setItem(prefixedKey('array'), '[]');
			sessionStorage.setItem(prefixedKey('object'), '{}');

			expect(readPageState('number', 'in_progress')).toBe(123);
			expect(readPageState('string', 'in_progress')).toBe('invalid-tab');
			expect(readPageState('array', 'in_progress')).toEqual([]);
			expect(readPageState('object', 'in_progress')).toEqual({});
		});

		it('round-trips adversarial string payloads unchanged', () => {
			const payloads = [
				'<script>alert(1)</script>',
				'"><img src=x onerror=alert(1)>',
				'\u202e\u0000\uD800',
				'a'.repeat(10_000),
			];

			for (const payload of payloads) {
				writePageState('adversarial', payload);
				expect(readPageState('adversarial', 'fallback')).toBe(payload);
				expect(sessionStorage.getItem(prefixedKey('adversarial'))).toBe(
					JSON.stringify(payload),
				);
			}
		});
	});

	describe('writePageState failure path', () => {
		it('swallows setItem errors and leaves the prior value readable', () => {
			writePageState('tasks:all:statusTab', 'all');

			vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
				throw new DOMException('QuotaExceededError');
			});

			expect(() => writePageState('tasks:all:statusTab', 'cancelled')).not.toThrow();
			expect(readPageState('tasks:all:statusTab', 'in_progress')).toBe('all');
		});
	});

	describe('real-world payload shapes', () => {
		it('stores day filter object with picked date', () => {
			const value: StoredDayFilter = {
				dayFilter: 'picked',
				pickedDayKey: '2026-09-04',
			};
			writePageState(tasksPageKey('all', 'dayFilter'), value);
			expect(
				readPageState(tasksPageKey('all', 'dayFilter'), DEFAULT_STORED_DAY_FILTER),
			).toEqual(value);
		});

		it('round-trips today and tomorrow day filter presets', () => {
			for (const dayFilter of ['today', 'tomorrow'] as const) {
				const value: StoredDayFilter = { dayFilter, pickedDayKey: null };
				writePageState(tasksPageKey('mine', 'dayFilter'), value);
				expect(
					readPageState(tasksPageKey('mine', 'dayFilter'), DEFAULT_STORED_DAY_FILTER),
				).toEqual(value);
			}
		});

		it('stores malformed picked filter as-is for caller sanitization', () => {
			const value = { dayFilter: 'picked', pickedDayKey: null };
			writePageState(tasksPageKey('all', 'dayFilter'), value);
			expect(
				readPageState(tasksPageKey('all', 'dayFilter'), DEFAULT_STORED_DAY_FILTER),
			).toEqual(value);
		});

		it('round-trips grid session state shape', () => {
			const value = {
				columnState: [{ colId: 'status', sort: 'asc' }],
				filterModel: { status: { filterType: 'text', type: 'equals', filter: 'Open' } },
			};
			writePageState('grid:tasks-all', value);
			expect(readPageState('grid:tasks-all', null)).toEqual(value);
		});

		it('round-trips crew map viewport shape', () => {
			const value = { lat: 36.1699, lng: -115.1398, zoom: 11 };
			writePageState('crewMap:viewport', value);
			expect(readPageState('crewMap:viewport', null)).toEqual(value);
		});
	});

	describe('usePageState', () => {
		beforeEach(() => {
			(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				true;
			container = document.createElement('div');
			document.body.appendChild(container);
			root = createRoot(container);
		});

		it('seeds initial state from sessionStorage', async () => {
			writePageState('probe:seed', 'stored');
			const handleRef = await mountPageStateProbe('probe:seed', 'fallback', container, root);
			expect(handleRef.current?.state).toBe('stored');
		});

		it('uses fallback when storage is empty', async () => {
			const handleRef = await mountPageStateProbe('probe:empty', 'fallback', container, root);
			expect(handleRef.current?.state).toBe('fallback');
		});

		it('persists setter updates to sessionStorage', async () => {
			const handleRef = await mountPageStateProbe('probe:set', 'initial', container, root);

			await act(async () => {
				handleRef.current?.setState('updated');
			});

			expect(handleRef.current?.state).toBe('updated');
			expect(readPageState('probe:set', 'initial')).toBe('updated');
		});

		it('supports functional updaters', async () => {
			const handleRef = await mountPageStateProbe('probe:fn', 1, container, root);

			await act(async () => {
				handleRef.current?.setState((prev) => prev + 1);
			});

			expect(handleRef.current?.state).toBe(2);
			expect(readPageState('probe:fn', 0)).toBe(2);
		});

		it('isolates state by key across probes', async () => {
			const containerB = document.createElement('div');
			document.body.appendChild(containerB);
			const rootB = createRoot(containerB);

			const handleRefA = await mountPageStateProbe('probe:a', 'a0', container, root);
			const handleRefB = await mountPageStateProbe('probe:b', 'b0', containerB, rootB);

			await act(async () => {
				handleRefA.current?.setState('a1');
				handleRefB.current?.setState('b1');
			});

			expect(handleRefA.current?.state).toBe('a1');
			expect(handleRefB.current?.state).toBe('b1');
			expect(readPageState('probe:a', 'a0')).toBe('a1');
			expect(readPageState('probe:b', 'b0')).toBe('b1');

			await act(async () => {
				rootB.unmount();
			});
			containerB.remove();
		});
	});
});
