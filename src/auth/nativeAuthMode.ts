import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'field.nativeAuthMode';

export type NativeAuthMode = 'idp' | 'device';

type ModeListener = (mode: NativeAuthMode | null) => void;

const listeners = new Set<ModeListener>();
let memoryMode: NativeAuthMode | null = null;
let loaded = false;

function notify() {
	for (const listener of listeners) {
		listener(memoryMode);
	}
}

export function subscribeNativeAuthMode(listener: ModeListener): () => void {
	listeners.add(listener);
	listener(memoryMode);
	return () => {
		listeners.delete(listener);
	};
}

export function getNativeAuthMode(): NativeAuthMode | null {
	return memoryMode;
}

export function isNativeAuthModeLoaded(): boolean {
	return loaded;
}

async function readStored(): Promise<string | null> {
	try {
		const { value } = await Preferences.get({ key: STORAGE_KEY });
		return value;
	} catch {
		return localStorage.getItem(STORAGE_KEY);
	}
}

async function writeStored(mode: NativeAuthMode): Promise<void> {
	try {
		await Preferences.set({ key: STORAGE_KEY, value: mode });
	} catch {
		localStorage.setItem(STORAGE_KEY, mode);
	}
}

async function removeStored(): Promise<void> {
	try {
		await Preferences.remove({ key: STORAGE_KEY });
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
	localStorage.removeItem(STORAGE_KEY);
}

export async function loadNativeAuthMode(): Promise<NativeAuthMode | null> {
	if (!Capacitor.isNativePlatform()) {
		memoryMode = null;
		loaded = true;
		notify();
		return null;
	}

	const value = await readStored();
	if (value === 'idp' || value === 'device') {
		memoryMode = value;
	} else {
		memoryMode = null;
	}

	loaded = true;
	notify();
	return memoryMode;
}

export async function setNativeAuthMode(
	mode: NativeAuthMode | null,
): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;

	memoryMode = mode;
	if (mode) {
		await writeStored(mode);
	} else {
		await removeStored();
	}
	notify();
}
