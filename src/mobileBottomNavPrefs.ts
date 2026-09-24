import { useCallback, useSyncExternalStore } from 'react';

export type MobileNavPinId = 'contacts' | 'addresses' | 'allTasks';

export type MobileBottomNavPins = Record<MobileNavPinId, boolean>;

const STORAGE_KEY = 'field.mobileBottomNavPins';

export const MOBILE_BOTTOM_NAV_PIN_DEFAULTS: MobileBottomNavPins = {
	contacts: true,
	addresses: false,
	allTasks: true,
};

/** Stable snapshot for useSyncExternalStore when storage is empty or on the server. */
const DEFAULT_SNAPSHOT: MobileBottomNavPins = {
	contacts: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.contacts,
	addresses: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.addresses,
	allTasks: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.allTasks,
};

let cachedSerialized: string | null = null;
let cachedSnapshot: MobileBottomNavPins = DEFAULT_SNAPSHOT;

const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function parseStored(raw: string): MobileBottomNavPins {
	try {
		const parsed = JSON.parse(raw) as Partial<MobileBottomNavPins>;
		return {
			contacts:
				typeof parsed.contacts === 'boolean'
					? parsed.contacts
					: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.contacts,
			addresses:
				typeof parsed.addresses === 'boolean'
					? parsed.addresses
					: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.addresses,
			allTasks:
				typeof parsed.allTasks === 'boolean'
					? parsed.allTasks
					: MOBILE_BOTTOM_NAV_PIN_DEFAULTS.allTasks,
		};
	} catch {
		return DEFAULT_SNAPSHOT;
	}
}

function readSnapshot(): MobileBottomNavPins {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw === cachedSerialized) return cachedSnapshot;
		cachedSerialized = raw;
		cachedSnapshot = raw ? parseStored(raw) : DEFAULT_SNAPSHOT;
		return cachedSnapshot;
	} catch {
		return cachedSnapshot;
	}
}

export function getMobileBottomNavPins(): MobileBottomNavPins {
	return readSnapshot();
}

export function setMobileNavPin(id: MobileNavPinId, pinned: boolean): void {
	const next = { ...getMobileBottomNavPins(), [id]: pinned };
	const serialized = JSON.stringify(next);
	try {
		localStorage.setItem(STORAGE_KEY, serialized);
		cachedSerialized = serialized;
		cachedSnapshot = next;
	} catch {
		/* ignore quota / private mode */
	}
	emit();
}

/** Device-local pins for optional mobile bottom tabs (Contacts, Addresses, All tasks). */
export function useMobileBottomNavPins(): [
	MobileBottomNavPins,
	(id: MobileNavPinId, pinned: boolean) => void,
] {
	const pins = useSyncExternalStore(
		subscribe,
		getMobileBottomNavPins,
		() => DEFAULT_SNAPSHOT,
	);
	const setPin = useCallback((id: MobileNavPinId, pinned: boolean) => {
		setMobileNavPin(id, pinned);
	}, []);
	return [pins, setPin];
}
