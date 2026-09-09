import { toast } from 'sonner';

/** Transient user-facing error (toast). Call from providers, API boundaries, or actions. */
export function notifyError(message: string): void {
	toast.error(message);
}

/** Transient user-facing success (toast). */
export function notifySuccess(message: string): void {
	toast.success(message);
}

/** Transient user-facing warning (toast). */
export function notifyWarning(message: string): void {
	toast.warning(message);
}

/** Transient user-facing info (toast). */
export function notifyInfo(message: string): void {
	toast.info(message);
}
