import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'field.taskListTypeFilters';

const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

function parseStored(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((value): value is string => typeof value === 'string');
	} catch {
		return [];
	}
}

const EMPTY_FILTERS: string[] = [];
let cachedSerialized: string | null = null;
let cachedSnapshot: string[] = EMPTY_FILTERS;

function readSnapshot(): string[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === cachedSerialized) return cachedSnapshot;
		cachedSerialized = raw;
		const parsed = parseStored(raw);
		cachedSnapshot = parsed.length === 0 ? EMPTY_FILTERS : parsed;
		return cachedSnapshot;
	} catch {
		if (cachedSnapshot === EMPTY_FILTERS) return EMPTY_FILTERS;
		cachedSerialized = null;
		cachedSnapshot = EMPTY_FILTERS;
		return EMPTY_FILTERS;
	}
}

export function getTaskListTypeFilters(): string[] {
	return readSnapshot();
}

export function setTaskListTypeFilters(filters: string[]): void {
	const next = filters.filter(
		(value, index, array) => value && array.indexOf(value) === index,
	);
	try {
		if (next.length === 0) {
			localStorage.removeItem(STORAGE_KEY);
			cachedSerialized = null;
			cachedSnapshot = EMPTY_FILTERS;
		} else {
			const serialized = JSON.stringify(next);
			localStorage.setItem(STORAGE_KEY, serialized);
			cachedSerialized = serialized;
			cachedSnapshot = next;
		}
	} catch {
		/* ignore quota / private mode */
	}
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Per-device task type filter for mobile task lists (when org has no default). */
export function useTaskListTypeFilters(): [
	string[],
	(filters: string[]) => void,
] {
	const filters = useSyncExternalStore(
		subscribe,
		getTaskListTypeFilters,
		() => [],
	);
	return [filters, setTaskListTypeFilters];
}
