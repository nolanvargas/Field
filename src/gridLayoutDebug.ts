import type { GridApi } from 'ag-grid-community';

const PREFIX = '[grid-layout]';
const STORAGE_KEY = 'field.gridLayoutDebug';

let seq = 0;
let announced = false;

function readOverride(): boolean | null {
	if (typeof window === 'undefined') return false;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw === '0' || raw === 'false') return false;
		if (raw === '1' || raw === 'true') return true;
	} catch {
		/* ignore */
	}
	return null;
}

export function isGridLayoutDebugEnabled(): boolean {
	const override = readOverride();
	if (override != null) return override;
	try {
		return import.meta.env.DEV === true && import.meta.env.MODE !== 'test';
	} catch {
		return true;
	}
}

function announceOnce(): void {
	if (announced) return;
	announced = true;
	console.info(
		`${PREFIX} verbose logs on — filter DevTools by "${PREFIX}". Disable: localStorage.setItem('${STORAGE_KEY}','0'); location.reload()`,
	);
}

export function gridLayoutLog(
	event: string,
	data?: Record<string, unknown>,
): void {
	if (!isGridLayoutDebugEnabled()) return;
	announceOnce();
	seq += 1;
	const payload = {
		seq,
		t: new Date().toISOString().slice(11, 23),
		...(data ?? {}),
	};
	console.log(`${PREFIX} ${event}`, payload);
}

export function snapshotDisplayedColumns(
	api: GridApi | null | undefined,
): { id: string; w: number }[] {
	try {
		const cols = api?.getAllDisplayedColumns?.();
		if (!cols?.length) return [];
		return cols.map((col) => ({
			id: typeof col.getColId === 'function' ? col.getColId() : '?',
			w: col.getActualWidth(),
		}));
	} catch {
		return [];
	}
}

export function sumSnapshotWidths(
	cols: { id: string; w: number }[],
): number {
	return cols.reduce((sum, col) => sum + (col.w || 0), 0);
}

export function snapshotWrap(
	shellEl: HTMLElement | null | undefined,
	wrapEl: HTMLElement | null | undefined,
): Record<string, unknown> {
	const pane = shellEl?.parentElement ?? shellEl ?? null;
	const chrome =
		wrapEl != null
			? Math.max(0, wrapEl.offsetWidth - wrapEl.clientWidth)
			: null;
	return {
		layout: wrapEl?.dataset.layout ?? null,
		styleWidth: wrapEl?.style.width || null,
		wrapClient: wrapEl?.clientWidth ?? null,
		wrapOffset: wrapEl?.offsetWidth ?? null,
		wrapChrome: chrome,
		shellClient: shellEl?.clientWidth ?? null,
		paneClient: pane?.clientWidth ?? null,
		paneInner:
			pane != null && chrome != null
				? Math.max(0, pane.clientWidth - chrome)
				: null,
		windowInner: typeof window === 'undefined' ? null : window.innerWidth,
	};
}

export function snapshotGrid(
	api: GridApi | null | undefined,
	shellEl?: HTMLElement | null,
	wrapEl?: HTMLElement | null,
): Record<string, unknown> {
	const columns = snapshotDisplayedColumns(api);
	return {
		columnSum: sumSnapshotWidths(columns),
		columns,
		...snapshotWrap(shellEl, wrapEl),
	};
}
