import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	type ReactNode,
} from 'react';
import { useAlert } from './AlertContext';

type GuardRegistration = {
	isDirty: () => boolean;
	discard: () => void;
	save: () => Promise<boolean>;
};

interface NavigationGuardContextValue {
	setGuard: (guard: GuardRegistration | null) => void;
	confirmLeave: () => Promise<boolean>;
}

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(
	null,
);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
	const guardRef = useRef<GuardRegistration | null>(null);
	const { confirmUnsavedChanges } = useAlert();

	const setGuard = useCallback((guard: GuardRegistration | null) => {
		guardRef.current = guard;
	}, []);

	const confirmLeave = useCallback(async () => {
		const guard = guardRef.current;
		if (!guard?.isDirty()) return true;
		const result = await confirmUnsavedChanges();
		if (result === 'stay') return false;
		if (result === 'save') return await guard.save();
		guard.discard();
		return true;
	}, [confirmUnsavedChanges]);

	return (
		<NavigationGuardContext.Provider value={{ setGuard, confirmLeave }}>
			{children}
		</NavigationGuardContext.Provider>
	);
}

export function useNavigationGuard(): NavigationGuardContextValue {
	const ctx = useContext(NavigationGuardContext);
	if (!ctx) {
		throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
	}
	return ctx;
}

/** Register a page-level unsaved-changes guard (e.g. Management settings draft). */
export function useRegisterNavigationGuard(
	isDirty: boolean,
	discard: () => void,
	save: () => Promise<boolean>,
	enabled = true,
) {
	const { setGuard } = useNavigationGuard();
	const dirtyRef = useRef(isDirty);
	dirtyRef.current = isDirty;
	const discardRef = useRef(discard);
	discardRef.current = discard;
	const saveRef = useRef(save);
	saveRef.current = save;

	useEffect(() => {
		if (!enabled) {
			setGuard(null);
			return;
		}
		setGuard({
			isDirty: () => dirtyRef.current,
			discard: () => discardRef.current(),
			save: () => saveRef.current(),
		});
		return () => setGuard(null);
	}, [enabled, setGuard]);
}

/** Warn when closing or refreshing the tab with unsaved changes. */
export function useBeforeUnloadWhenDirty(isDirty: boolean) {
	useEffect(() => {
		if (!isDirty) return;
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [isDirty]);
}
