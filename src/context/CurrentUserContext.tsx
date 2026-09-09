import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from 'react';
import { Capacitor } from '@capacitor/core';
import { listUsers, syncSession, type AppUser } from '../api/users';
import { isWebAuthEnabled } from '../auth/config';
import {
	getMobileSession,
	loadMobileSession,
	subscribeMobileSession,
	type MobileDeviceSession,
} from '../auth/mobileSession';

const STORAGE_KEY = 'field.currentUserId';
/** Don't block the native splash on a bad API host (e.g. 10.0.2.2 on a phone). */
const NATIVE_USERS_TIMEOUT_MS = 4_000;

interface CurrentUserContextValue {
	user: AppUser | null;
	users: AppUser[];
	loading: boolean;
	setUserId: (id: string | null) => void;
	/** Merge a PATCH result into the cached current user / roster. */
	patchCachedUser: (next: AppUser) => void;
	/** Web SSO active — user comes from session sync, not picker. */
	webSsoMode: boolean;
	/** Capacitor device session from QR activation. */
	mobileSession: MobileDeviceSession | null;
	/** Re-read users after activation (native). */
	refreshAfterMobileActivation: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function useWebSsoMode(): boolean {
	return !Capacitor.isNativePlatform() && isWebAuthEnabled();
}

function sessionToUser(session: MobileDeviceSession): AppUser {
	return {
		id: session.userId,
		displayName: session.displayName,
		email: '',
		phone: '',
		role: session.role || '',
		permissions: session.permissions ?? [],
		customFields: {},
		customFieldDisplays: {},
	};
}

function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	const onAbort = () => {
		clearTimeout(timer);
		controller.abort();
	};
	if (signal.aborted) {
		onAbort();
	} else {
		signal.addEventListener('abort', onAbort, { once: true });
	}
	return controller.signal;
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
	const webSsoMode = useWebSsoMode();
	const isNative = Capacitor.isNativePlatform();
	const [users, setUsers] = useState<AppUser[]>([]);
	const [userId, setUserIdState] = useState<string | null>(() =>
		webSsoMode || isNative ? null : localStorage.getItem(STORAGE_KEY),
	);
	const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
	const [mobileSession, setMobileSession] = useState<MobileDeviceSession | null>(
		null,
	);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!isNative) return;
		return subscribeMobileSession((session) => {
			setMobileSession(session);
			if (session) {
				setSessionUser(sessionToUser(session));
				setUserIdState(session.userId);
			} else {
				setSessionUser(null);
			}
		});
	}, [isNative]);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);

		async function boot() {
			try {
				if (isNative) {
					const session = await loadMobileSession();
					if (controller.signal.aborted) return;

					if (session) {
						setMobileSession(session);
						setSessionUser(sessionToUser(session));
						setUserIdState(session.userId);
						setUsers([sessionToUser(session)]);
						// UI is ready — refresh roster in the background (may fail on bad API host).
						setLoading(false);
						void listUsers(withTimeout(controller.signal, NATIVE_USERS_TIMEOUT_MS))
							.then((list) => {
								if (!controller.signal.aborted) setUsers(list);
							})
							.catch(() => {
								/* keep session user */
							});
						return;
					}

					// No device session yet — do not block on /api/users (Entra 401 or
					// unreachable 10.0.2.2 on a physical device). MobileAuthGate → QR.
					setUsers([]);
					setUserIdState(null);
					setLoading(false);
					return;
				}

				if (webSsoMode) {
					const u = await syncSession(controller.signal);
					if (controller.signal.aborted) return;
					setSessionUser(u);
					setUserIdState(u.id);
					const list = await listUsers(controller.signal);
					if (!controller.signal.aborted) setUsers(list);
					return;
				}

				const list = await listUsers(controller.signal);
				if (controller.signal.aborted) return;
				setUsers(list);
				setUserIdState((prev) => {
					if (prev && list.some((u) => u.id === prev)) return prev;
					const next = list[0]?.id ?? null;
					if (next) localStorage.setItem(STORAGE_KEY, next);
					else localStorage.removeItem(STORAGE_KEY);
					return next;
				});
			} catch (err: unknown) {
				if (
					(err instanceof DOMException || err instanceof Error) &&
					err.name === 'AbortError'
				) {
					return;
				}
				console.error(err);
				setSessionUser(null);
				setUsers([]);
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}

		void boot();
		return () => controller.abort();
	}, [webSsoMode, isNative]);

	const setUserId = (id: string | null) => {
		if (webSsoMode || getMobileSession()) return;
		setUserIdState(id);
		if (id) localStorage.setItem(STORAGE_KEY, id);
		else localStorage.removeItem(STORAGE_KEY);
	};

	const patchCachedUser = (next: AppUser) => {
		setUsers((prev) =>
			prev.map((u) => (u.id === next.id ? { ...u, ...next } : u)),
		);
		setSessionUser((prev) =>
			prev?.id === next.id ? { ...prev, ...next } : prev,
		);
		setMobileSession((prev) => {
			if (!prev || prev.userId !== next.id) return prev;
			return {
				...prev,
				displayName: next.displayName,
				role: next.role,
				permissions: next.permissions,
			};
		});
	};

	const refreshAfterMobileActivation = async () => {
		const session = getMobileSession();
		if (!session) return;
		setMobileSession(session);
		setSessionUser(sessionToUser(session));
		setUserIdState(session.userId);
		setUsers([sessionToUser(session)]);
		try {
			const list = await listUsers();
			setUsers(list);
		} catch {
			/* keep session user */
		}
	};

	const user = (() => {
		if (isNative && mobileSession) return sessionToUser(mobileSession);
		if (webSsoMode) return sessionUser;
		return users.find((u) => u.id === userId) ?? null;
	})();

	return (
		<CurrentUserContext.Provider
			value={{
				user,
				users,
				loading,
				setUserId,
				patchCachedUser,
				webSsoMode,
				mobileSession,
				refreshAfterMobileActivation,
			}}
		>
			{children}
		</CurrentUserContext.Provider>
	);
}

export function useCurrentUser(): CurrentUserContextValue {
	const ctx = useContext(CurrentUserContext);
	if (!ctx) {
		throw new Error('useCurrentUser must be used within CurrentUserProvider');
	}
	return ctx;
}
