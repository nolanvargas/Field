import { useSyncExternalStore } from 'react';
import { gridLayoutLog } from './gridLayoutDebug';

const FORCE_FULL_WIDTH_KEY = 'field.gridForceFullWidth';

const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function readFlag(key: string): boolean {
	try {
		return localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
}

function writeFlag(key: string, enabled: boolean): void {
	try {
		if (enabled) localStorage.setItem(key, '1');
		else localStorage.removeItem(key);
	} catch {
		/* ignore quota / private mode */
	}
	emit();
}

export function getGridForceFullWidth(): boolean {
	return readFlag(FORCE_FULL_WIDTH_KEY);
}

export function setGridForceFullWidth(enabled: boolean): void {
	gridLayoutLog('setGridForceFullWidth', {
		from: getGridForceFullWidth(),
		to: enabled,
	});
	writeFlag(FORCE_FULL_WIDTH_KEY, enabled);
}

/** Persisted: always stretch grid to pane width (skip compact centering). */
export function useGridForceFullWidth(): [boolean, (enabled: boolean) => void] {
	const enabled = useSyncExternalStore(
		subscribe,
		getGridForceFullWidth,
		() => false,
	);
	return [enabled, setGridForceFullWidth];
}
