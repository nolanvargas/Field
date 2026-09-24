export type ConnectivityIssue = 'offline' | 'unreachable';

export type FieldConnectivitySnapshot = {
	issue: ConnectivityIssue | null;
};

type Listener = (snapshot: FieldConnectivitySnapshot) => void;

const listeners = new Set<Listener>();

let browserOnline =
	typeof navigator === 'undefined' ? true : navigator.onLine;
let apiReachable = true;

let started = false;

function snapshot(): FieldConnectivitySnapshot {
	if (!browserOnline) {
		return { issue: 'offline' };
	}
	if (!apiReachable) {
		return { issue: 'unreachable' };
	}
	return { issue: null };
}

function notify() {
	const next = snapshot();
	for (const listener of listeners) {
		listener(next);
	}
}

export function getFieldConnectivity(): FieldConnectivitySnapshot {
	return snapshot();
}

export function subscribeFieldConnectivity(
	listener: Listener,
): () => void {
	listeners.add(listener);
	listener(snapshot());
	return () => {
		listeners.delete(listener);
	};
}

export function reportNetworkFetchFailure(): void {
	apiReachable = false;
	notify();
}

export function reportNetworkFetchSuccess(): void {
	if (!apiReachable) {
		apiReachable = true;
		notify();
	}
}

export function startFieldConnectivity(): void {
	if (started || typeof window === 'undefined') return;
	started = true;

	const onOnline = () => {
		browserOnline = true;
		apiReachable = true;
		notify();
	};

	const onOffline = () => {
		browserOnline = false;
		notify();
	};

	window.addEventListener('online', onOnline);
	window.addEventListener('offline', onOffline);
}

export function isNetworkFetchError(err: unknown): boolean {
	if (err instanceof DOMException || err instanceof Error) {
		if (err.name === 'AbortError') return false;
		return /failed to fetch|network|connection|timed out/i.test(err.message);
	}
	return false;
}
