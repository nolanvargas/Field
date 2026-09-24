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
import { DEMO_ADMIN_USER_ID } from '../demo/fixtures/boot';
import { isDemoMode } from '../demo/isDemoMode';
import {
	getMobileSession,
	loadMobileSession,
	subscribeMobileSession,
	type MobileDeviceSession,
} from '../auth/mobileSession';
import {
	getNativeAuthMode,
	loadNativeAuthMode,
	setNativeAuthMode,
	subscribeNativeAuthMode,
	type NativeAuthMode,
} from '../auth/nativeAuthMode';

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
	/** Web or native IdP — user from session sync, not picker or QR cache. */
	webSsoMode: boolean;
	/** Capacitor device session from QR activation. */
	mobileSession: MobileDeviceSession | null;
	/** Native sign-in mode (`idp` | `device` | null). */
	nativeAuthMode: NativeAuthMode | null;
	/** Re-read users after activation (native). */
	refreshAfterMobileActivation: () => Promise<void>;
	/** Re-read session after native IdP sign-in. */
	refreshAfterIdpSignIn: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

function useWebSsoMode(nativeAuthMode: NativeAuthMode | null): boolean {
	if (!isWebAuthEnabled()) return false;
	if (Capacitor.isNativePlatform()) {
		return nativeAuthMode === 'idp';
	}
	return true;
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
	const isNative = Capacitor.isNativePlatform();
	const [nativeAuthMode, setNativeAuthModeState] =
		useState<NativeAuthMode | null>(() =>
			isNative ? getNativeAuthMode() : null,
		);
	const webSsoMode = useWebSsoMode(nativeAuthMode);
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
		return subscribeNativeAuthMode((mode) => {
			setNativeAuthModeState(mode);
		});
	}, [isNative]);

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
					const mode = await loadNativeAuthMode();
					if (mode === 'idp' && !isWebAuthEnabled()) {
						await setNativeAuthMode(null);
					}
					const session = await loadMobileSession();
					if (controller.signal.aborted) return;

					if (mode === 'idp' && isWebAuthEnabled()) {
						try {
							const u = await syncSession(
								withTimeout(controller.signal, NATIVE_USERS_TIMEOUT_MS),
							);
							if (controller.signal.aborted) return;
							setSessionUser(u);
							setUserIdState(u.id);
							const list = await listUsers(
								withTimeout(controller.signal, NATIVE_USERS_TIMEOUT_MS),
							);
							if (!controller.signal.aborted) setUsers(list);
						} catch {
							setSessionUser(null);
							setUsers([]);
						}
						setLoading(false);
						return;
					}

					if (session && mode === 'device') {
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

					// No active session — MobileAuthGate → sign-in / activate picker.
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
					if (isDemoMode()) {
						const demoId = list.some((u) => u.id === DEMO_ADMIN_USER_ID)
							? DEMO_ADMIN_USER_ID
							: (list[0]?.id ?? null);
						if (demoId) localStorage.setItem(STORAGE_KEY, demoId);
						else localStorage.removeItem(STORAGE_KEY);
						return demoId;
					}
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

	const refreshAfterIdpSignIn = async () => {
		try {
			const u = await syncSession();
			setSessionUser(u);
			setUserIdState(u.id);
			const list = await listUsers();
			setUsers(list);
		} catch (err: unknown) {
			console.error(err);
		}
	};

	const user = (() => {
		if (isNative && nativeAuthMode === 'device' && mobileSession) {
			return sessionToUser(mobileSession);
		}
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
				nativeAuthMode,
				refreshAfterMobileActivation,
				refreshAfterIdpSignIn,
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
