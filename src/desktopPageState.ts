import { useCallback, useState } from 'react';

const STORAGE_PREFIX = 'field.pageState.';

function storageKey(key: string): string {
	return `${STORAGE_PREFIX}${key}`;
}

/** Read a JSON value from sessionStorage, returning fallback on miss or parse error. */
export function readPageState<T>(key: string, fallback: T): T {
	try {
		const raw = sessionStorage.getItem(storageKey(key));
		if (raw == null) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

/** Write a JSON value to sessionStorage. */
export function writePageState<T>(key: string, value: T): void {
	try {
		sessionStorage.setItem(storageKey(key), JSON.stringify(value));
	} catch {
		/* private mode / quota */
	}
}

/** React state seeded from sessionStorage; writes back on every update. */
export function usePageState<T>(key: string, fallback: T): [T, (value: T | ((prev: T) => T)) => void] {
	const [state, setState] = useState<T>(() => readPageState(key, fallback));
	const setPageState = useCallback(
		(value: T | ((prev: T) => T)) => {
			setState((prev) => {
				const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
				writePageState(key, next);
				return next;
			});
		},
		[key],
	);
	return [state, setPageState];
}

export function tasksPageKey(
	mode: 'all' | 'mine',
	field: 'statusTab' | 'dayFilter' | 'listView' | 'focusDayKey',
): string {
	return `tasks:${mode}:${field}`;
}

export type StoredDayFilter = {
	dayFilter: 'all' | 'today' | 'tomorrow' | 'picked';
	pickedDayKey: string | null;
};

export const DEFAULT_STORED_DAY_FILTER: StoredDayFilter = {
	dayFilter: 'all',
	pickedDayKey: null,
};
