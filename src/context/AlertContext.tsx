import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import { AlertModal, type AlertModalKind } from '../components/AlertModal';
import { notifyInfo } from '../notify';

export type ConfirmOptions = {
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
};

export type UnsavedChangesResult = 'save' | 'discard' | 'stay';

type AlertRequest = {
	kind: AlertModalKind;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	resolve: (result: boolean | UnsavedChangesResult) => void;
};

interface AlertContextValue {
	alert: (message: string) => Promise<void>;
	confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
	confirmUnsavedChanges: (message?: string) => Promise<UnsavedChangesResult>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
	const [queue, setQueue] = useState<AlertRequest[]>([]);
	const current = queue[0] ?? null;

	const enqueue = useCallback(
		(
			kind: AlertModalKind,
			message: string,
			options?: ConfirmOptions,
		): Promise<boolean | UnsavedChangesResult> =>
			new Promise((resolve) => {
				setQueue((prev) => [
					...prev,
					{
						kind,
						message,
						confirmLabel: options?.confirmLabel,
						cancelLabel: options?.cancelLabel,
						danger: options?.danger,
						resolve,
					},
				]);
			}),
		[],
	);

	const alert = useCallback(async (message: string) => {
		notifyInfo(message);
	}, []);

	const confirm = useCallback(
		async (message: string, options?: ConfirmOptions) => {
			const result = await enqueue('confirm', message, options);
			return result === true;
		},
		[enqueue],
	);

	const confirmUnsavedChanges = useCallback(
		async (message = 'You have unsaved changes.') => {
			const result = await enqueue('unsavedChanges', message);
			if (result === 'save' || result === 'discard' || result === 'stay') {
				return result;
			}
			return 'stay';
		},
		[enqueue],
	);

	const settle = (result: boolean | UnsavedChangesResult) => {
		if (!current) return;
		current.resolve(result);
		setQueue((prev) => prev.slice(1));
	};

	const value = useMemo(
		() => ({ alert, confirm, confirmUnsavedChanges }),
		[alert, confirm, confirmUnsavedChanges],
	);

	return (
		<AlertContext.Provider value={value}>
			{children}
			<AlertModal
				opened={current != null}
				kind={current?.kind ?? 'alert'}
				message={current?.message ?? ''}
				confirmLabel={current?.confirmLabel}
				cancelLabel={current?.cancelLabel}
				danger={current?.danger}
				onConfirm={() => settle(true)}
				onCancel={() =>
					settle(current?.kind === 'unsavedChanges' ? 'stay' : false)
				}
				onSaveChanges={() => settle('save')}
				onDiscardChanges={() => settle('discard')}
			/>
		</AlertContext.Provider>
	);
}

export function useAlert(): AlertContextValue {
	const ctx = useContext(AlertContext);
	if (!ctx) {
		throw new Error('useAlert must be used within AlertProvider');
	}
	return ctx;
}
