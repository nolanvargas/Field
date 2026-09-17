import {
	createElement,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MutableRefObject,
} from 'react';
import {
	convertColumnState,
	type ColDef,
	type ColumnResizedEvent,
	type ColumnState,
	type FilterModel,
	type GridApi,
	type GridReadyEvent,
	type GridState,
	type ICellRendererParams,
	type ValueFormatterParams,
} from 'ag-grid-community';
import type { Address } from './api/addresses';
import type { Contact } from './api/contacts';
import type { AppUser } from './api/users';
import type { OrgCustomFieldDef } from './api/orgSettings';
import { hasDestinationCoords } from '../shared/destinationCoords.js';
import { RelativeTime } from './components/RelativeTime';
import { TaskStatusBadge } from './components/TaskStatusBadge';
import type { CustomFieldValue, Task, TaskStatus } from './types/task';
import {
	formatCustomFieldValue,
	isCustomFieldUndefined,
	labeledCustomFieldDefs,
	type WithCustomFields,
} from './customFields';
import { formatShortName } from './formatName';
import { htmlToPlainText } from './taskDescHtml';
import { readPageState, writePageState } from './desktopPageState';
import { getGridForceFullWidth } from './agGridLayoutPrefs';
import {
	gridLayoutLog,
	snapshotDisplayedColumns,
	snapshotGrid,
	sumSnapshotWidths,
} from './gridLayoutDebug';
import {
	type BandedGridColumnLayoutV2,
	type GridWidthBand,
	bandHasSavedWidths,
	buildColumnStateForBand,
	emptyBandedGridColumnLayout,
	estimatePaneWidthFromWindow,
	gridWidthBandFromPaneWidth,
	isUserColumnResizeEvent,
	parseBandedGridColumnLayout,
	updateBandWidthsFromApi,
	updateSharedLayoutFromApi,
} from './gridColumnWidthBands';

/**
 * Mobile breakpoint for AG Grid pages — matches AppShell `sm`
 * (`max-width` just under 48em).
 */
export const AG_GRID_MOBILE_MQ = '(max-width: 47.9975em)';

const sharedDefaultColDef: ColDef = {
	sortable: true,
};

/** Desktop: filters on; widths change via header wheel, not edge sliders. */
export const desktopDefaultColDef: ColDef = {
	...sharedDefaultColDef,
	filter: true,
	resizable: false,
};

/** Mobile: filters off; native edge-resize handles stay. */
export const mobileDefaultColDef: ColDef = {
	...sharedDefaultColDef,
	filter: false,
	resizable: true,
};

export function getDefaultColDef(isMobile: boolean | undefined): ColDef {
	return isMobile ? mobileDefaultColDef : desktopDefaultColDef;
}

export type HeaderWheelColumn = {
	colId: string;
	width: number;
	minWidth: number;
	maxWidth: number;
};

function columnMaxWidth(col: HeaderWheelColumn): number {
	return col.maxWidth > 0 && Number.isFinite(col.maxWidth)
		? col.maxWidth
		: Number.POSITIVE_INFINITY;
}

function columnMinWidth(col: HeaderWheelColumn): number {
	return Math.max(0, col.minWidth);
}

/** Scroll up widens the hovered column; per-event change is capped. */
export function wheelDeltaToWidthPx(event: {
	deltaY: number;
	deltaX: number;
	deltaMode: number;
}): number {
	const raw = event.deltaY !== 0 ? event.deltaY : event.deltaX;
	const scale =
		event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 48 : 1;
	return Math.max(-40, Math.min(40, Math.round(-raw * scale)));
}

export type HeaderWheelWidthMode = {
	/** When true (default), other columns absorb the opposite delta so total width stays fixed. */
	conserveTotal?: boolean;
};

function hoveredColumnWidthUpdate(
	displayed: HeaderWheelColumn[],
	hoverIdx: number,
	deltaPx: number,
): { key: string; newWidth: number }[] | null {
	const col = displayed[hoverIdx];
	const next = Math.round(
		Math.min(
			columnMaxWidth(col),
			Math.max(columnMinWidth(col), col.width + deltaPx),
		),
	);
	if (next === col.width) return null;
	return [{ key: col.colId, newWidth: next }];
}

/**
 * Widen/narrow the hovered column.
 * Force-full-width conserves total width (other columns absorb the opposite
 * delta). Otherwise only the hovered column changes so the table can grow or shrink.
 */
export function columnWidthsFromHeaderWheel(
	displayed: HeaderWheelColumn[],
	hoveredColId: string,
	deltaPx: number,
	options?: HeaderWheelWidthMode,
): { key: string; newWidth: number }[] | null {
	if (deltaPx === 0 || displayed.length === 0) return null;
	const hoverIdx = displayed.findIndex((col) => col.colId === hoveredColId);
	if (hoverIdx < 0) return null;

	const n = displayed.length;
	const conserveTotal = options?.conserveTotal !== false;
	if (!conserveTotal || n === 1) {
		return hoveredColumnWidthUpdate(displayed, hoverIdx, deltaPx);
	}

	const widths = displayed.map((col) => col.width);
	const mins = displayed.map(columnMinWidth);
	const maxs = displayed.map(columnMaxWidth);

	const others = n - 1;
	let transfer = Math.round(deltaPx);
	if (transfer > 0) {
		const capHover = Math.floor(maxs[hoverIdx] - widths[hoverIdx]);
		let capOthers = Number.POSITIVE_INFINITY;
		for (let i = 0; i < n; i++) {
			if (i === hoverIdx) continue;
			capOthers = Math.min(
				capOthers,
				Math.floor(widths[i] - mins[i]) * others,
			);
		}
		transfer = Math.min(transfer, capHover, capOthers);
	} else {
		const capHover = Math.floor(widths[hoverIdx] - mins[hoverIdx]);
		let capOthers = Number.POSITIVE_INFINITY;
		for (let i = 0; i < n; i++) {
			if (i === hoverIdx) continue;
			capOthers = Math.min(
				capOthers,
				Math.floor(maxs[i] - widths[i]) * others,
			);
		}
		transfer = -Math.min(-transfer, capHover, capOthers);
	}
	if (transfer === 0) return null;

	const next = widths.slice();
	next[hoverIdx] = widths[hoverIdx] + transfer;

	const totalOthersDelta = -transfer;
	const perOther = Math.trunc(totalOthersDelta / others);
	let remainder = totalOthersDelta - perOther * others;
	const otherIdxs: number[] = [];
	for (let i = 0; i < n; i++) {
		if (i === hoverIdx) continue;
		otherIdxs.push(i);
		next[i] = widths[i] + perOther;
	}
	for (let k = 0; remainder !== 0; k++) {
		const i = otherIdxs[k % otherIdxs.length];
		if (remainder > 0) {
			next[i] += 1;
			remainder -= 1;
		} else {
			next[i] -= 1;
			remainder += 1;
		}
	}

	const updates: { key: string; newWidth: number }[] = [];
	for (let i = 0; i < n; i++) {
		if (next[i] !== widths[i]) {
			updates.push({ key: displayed[i].colId, newWidth: next[i] });
		}
	}
	return updates.length > 0 ? updates : null;
}

function wheelEventOverGridHeader(
	event: Event,
	wrap: HTMLElement,
): HTMLElement | null {
	const target = event.target;
	if (!(target instanceof Element)) return null;
	if (target.closest('.ag-popup, .ag-menu, .ag-filter-wrapper')) {
		return null;
	}
	const header = target.closest('.ag-header');
	if (!(header instanceof HTMLElement) || !wrap.contains(header)) {
		return null;
	}
	return header;
}

/** True when the wheel event is over this grid's column header row (not filter popups). */
export function isGridHeaderWheelEvent(event: Event, wrap: HTMLElement): boolean {
	return wheelEventOverGridHeader(event, wrap) != null;
}

export function headerCellColIdFromEvent(
	event: Event,
	wrap: HTMLElement,
): string | null {
	const target = event.target;
	if (!(target instanceof Element)) return null;
	if (target.closest('.ag-popup, .ag-menu, .ag-filter-wrapper')) {
		return null;
	}
	const header = target.closest('.ag-header-cell');
	if (!(header instanceof HTMLElement) || !wrap.contains(header)) {
		return null;
	}
	return header.getAttribute('col-id');
}

export type AdaptiveGridLayoutMode = 'compact' | 'full';

export type ApplyAdaptiveGridLayoutOptions = {
	skipAutoSize?: boolean;
	forceFullWidth?: boolean;
	/**
	 * With `skipAutoSize`, column sum on the API may be pane-fitted while persisted
	 * band widths still exceed the pane — stay full until saved widths fit.
	 */
	savedBandContentWidth?: number | null;
	/** Console-only: who requested this apply (see `[grid-layout]` logs). */
	debugReason?: string;
};

export type AdaptiveGridLayoutResult = {
	mode: AdaptiveGridLayoutMode;
	compactWidth: number | null;
};

export function sumDisplayedColumnWidths(api: GridApi): number {
	return (
		api
			.getAllDisplayedColumns()
			?.reduce((sum, col) => sum + col.getActualWidth(), 0) ?? 0
	);
}

/** Sum persisted band widths for displayed columns (falls back to actual width). */
export function savedBandContentWidthForDisplayed(
	layout: BandedGridColumnLayoutV2,
	band: GridWidthBand,
	api: GridApi,
): number {
	const bandWidths = layout.widthsByBand[band];
	if (!bandWidths) return sumDisplayedColumnWidths(api);
	const displayed = api.getAllDisplayedColumns() ?? [];
	return displayed.reduce((sum, col) => {
		const saved = bandWidths[col.getColId()];
		return sum + (saved ?? col.getActualWidth());
	}, 0);
}

function adaptiveApplyOptionsForSavedBand(
	api: GridApi,
	layout: BandedGridColumnLayoutV2 | null,
	band: GridWidthBand,
	skipAutoSize: boolean,
	debugReason: string,
): ApplyAdaptiveGridLayoutOptions {
	const options: ApplyAdaptiveGridLayoutOptions = {
		skipAutoSize,
		debugReason,
	};
	if (
		skipAutoSize &&
		layout != null &&
		bandHasSavedWidths(layout, band)
	) {
		options.savedBandContentWidth = savedBandContentWidthForDisplayed(
			layout,
			band,
			api,
		);
	}
	return options;
}

export function columnSumAfterWidthUpdates(
	displayed: { colId: string; width: number }[],
	updates: { key: string; newWidth: number }[],
): number {
	const next = new Map(updates.map((u) => [u.key, u.newWidth]));
	return displayed.reduce(
		(sum, col) => sum + (next.get(col.colId) ?? col.width),
		0,
	);
}

function setWrapLayout(
	wrapEl: HTMLElement,
	mode: AdaptiveGridLayoutMode,
	compactWidth: number | null,
): void {
	const prevMode = wrapEl.dataset.layout ?? null;
	const prevWidth = wrapEl.style.width || null;
	wrapEl.dataset.layout = mode;
	wrapEl.style.removeProperty('height');
	if (mode === 'compact' && compactWidth != null) {
		wrapEl.style.width = `${compactWidth}px`;
		wrapEl.style.setProperty('--tasks-grid-compact-width', `${compactWidth}px`);
	} else {
		wrapEl.style.removeProperty('width');
		wrapEl.style.removeProperty('--tasks-grid-compact-width');
	}
	const nextWidth = wrapEl.style.width || null;
	if (prevMode !== mode || prevWidth !== nextWidth) {
		gridLayoutLog('setWrapLayout', {
			from: prevMode,
			to: mode,
			compactWidth,
			prevWidth,
			nextWidth,
		});
	}
}

function wrapBorderChrome(wrapEl: HTMLElement): number {
	const chrome = wrapEl.offsetWidth - wrapEl.clientWidth;
	return chrome > 0 ? chrome : 0;
}

/**
 * Available inner width for columns. Use the shell's parent so compact
 * shrink-wrap does not shrink the pane measurement on the next pass.
 */
export function gridPaneInnerWidth(
	shellEl: HTMLElement,
	wrapEl: HTMLElement,
): number {
	const pane = shellEl.parentElement ?? shellEl;
	return Math.max(0, pane.clientWidth - wrapBorderChrome(wrapEl));
}

/** Wrap shrink/grow is not a pane change — don't re-autosize from it. */
function shouldSkipWrapOnlyGridSizeChange(
	lastPaneInnerRef: MutableRefObject<number | null>,
	shellEl: HTMLElement | null | undefined,
	wrapEl: HTMLElement | null | undefined,
): { skip: boolean; pane: number | null } {
	if (!shellEl || !wrapEl) return { skip: false, pane: null };
	const pane = gridPaneInnerWidth(shellEl, wrapEl);
	const skip = lastPaneInnerRef.current === pane;
	if (!skip) lastPaneInnerRef.current = pane;
	return { skip, pane };
}

function compactWrapWidth(contentWidth: number, wrapEl: HTMLElement): number {
	return contentWidth + wrapBorderChrome(wrapEl);
}

/**
 * Full width: stretch columns to the pane.
 * Otherwise wrap the grid to the column sum when they fit.
 * Height always fills the remaining pane so the grid owns vertical scroll.
 */
export function applyAdaptiveGridLayout(
	api: GridApi,
	shellEl: HTMLElement | null,
	wrapEl: HTMLElement | null,
	options?: ApplyAdaptiveGridLayoutOptions,
): AdaptiveGridLayoutResult {
	const before = snapshotGrid(api, shellEl, wrapEl);
	gridLayoutLog('applyAdaptiveGridLayout.enter', {
		reason: options?.debugReason ?? null,
		skipAutoSize: options?.skipAutoSize === true,
		forceFullWidth: options?.forceFullWidth === true,
		hasShell: shellEl != null,
		hasWrap: wrapEl != null,
		before,
	});

	if (!shellEl || !wrapEl) {
		if (wrapEl) setWrapLayout(wrapEl, 'full', null);
		const result = { mode: 'full' as const, compactWidth: null };
		gridLayoutLog('applyAdaptiveGridLayout.exit', {
			branch: 'missing-els',
			result,
			after: snapshotGrid(api, shellEl, wrapEl),
		});
		return result;
	}

	if (options?.forceFullWidth) {
		const willSizeColumnsToFit = !options?.skipAutoSize;
		setWrapLayout(wrapEl, 'full', null);
		gridLayoutLog('applyAdaptiveGridLayout.forceFullWidth', {
			reason: options?.debugReason ?? null,
			skipAutoSize: options?.skipAutoSize === true,
			willSizeColumnsToFit,
		});
		if (willSizeColumnsToFit) {
			api.sizeColumnsToFit();
		}
		const result = { mode: 'full' as const, compactWidth: null };
		gridLayoutLog('applyAdaptiveGridLayout.exit', {
			branch: 'forceFullWidth',
			result,
			sizedToFit: willSizeColumnsToFit,
			after: snapshotGrid(api, shellEl, wrapEl),
		});
		return result;
	}

	if (!options?.skipAutoSize) {
		gridLayoutLog('applyAdaptiveGridLayout.autoSizeAllColumns', {
			reason: options?.debugReason ?? null,
		});
		api.autoSizeAllColumns();
	}

	const contentWidth = sumDisplayedColumnWidths(api);
	const maxInner = gridPaneInnerWidth(shellEl, wrapEl);
	const savedBandContentWidth = options?.savedBandContentWidth;
	const latchFullFromSavedOverflow =
		options?.skipAutoSize === true &&
		savedBandContentWidth != null &&
		savedBandContentWidth > maxInner;

	if (latchFullFromSavedOverflow) {
		gridLayoutLog('applyAdaptiveGridLayout.latch-full-saved-overflow', {
			reason: options?.debugReason ?? null,
			contentWidth,
			savedBandContentWidth,
			maxInner,
			overflowBy: savedBandContentWidth - maxInner,
			willSizeColumnsToFit: false,
		});
		setWrapLayout(wrapEl, 'full', null);
		const result = { mode: 'full' as const, compactWidth: null };
		gridLayoutLog('applyAdaptiveGridLayout.exit', {
			branch: 'latch-full-saved-overflow',
			contentWidth,
			maxInner,
			result,
			after: snapshotGrid(api, shellEl, wrapEl),
		});
		return result;
	}

	if (contentWidth > 0 && contentWidth <= maxInner) {
		const wrapWidth = compactWrapWidth(contentWidth, wrapEl);
		setWrapLayout(wrapEl, 'compact', wrapWidth);
		const result = { mode: 'compact' as const, compactWidth: wrapWidth };
		gridLayoutLog('applyAdaptiveGridLayout.exit', {
			branch: 'compact',
			contentWidth,
			maxInner,
			gapToFull: maxInner - contentWidth,
			result,
			after: snapshotGrid(api, shellEl, wrapEl),
		});
		return result;
	}

	const overflowBy = contentWidth - maxInner;
	const willSizeColumnsToFit = options?.skipAutoSize !== true;
	gridLayoutLog('applyAdaptiveGridLayout.hit-full-width', {
		reason: options?.debugReason ?? null,
		skipAutoSize: options?.skipAutoSize === true,
		contentWidth,
		maxInner,
		overflowBy,
		willSizeColumnsToFit,
	});
	setWrapLayout(wrapEl, 'full', null);
	if (willSizeColumnsToFit) {
		api.sizeColumnsToFit();
	}
	const result = { mode: 'full' as const, compactWidth: null };
	gridLayoutLog('applyAdaptiveGridLayout.exit', {
		branch: 'overflow-to-full',
		contentWidth,
		maxInner,
		overflowBy,
		sizedToFit: willSizeColumnsToFit,
		result,
		after: snapshotGrid(api, shellEl, wrapEl),
	});
	return result;
}

export type AdaptiveGridLayout = ReturnType<typeof useAdaptiveGridLayout>;

/** Wire header-wheel saves into `usePersistedTaskGridColumns` / `usePersistedAgGridSession`. */
export function useBandedColumnWidthSaveBridge() {
	const userWidthsSaveRef = useRef<(api: GridApi) => void>(() => {});
	const onUserColumnWidthsSettled = useCallback((api: GridApi) => {
		gridLayoutLog('userColumnWidthsSettled', {
			columns: snapshotDisplayedColumns(api),
			columnSum: sumSnapshotWidths(snapshotDisplayedColumns(api)),
		});
		userWidthsSaveRef.current(api);
	}, []);
	return { userWidthsSaveRef, onUserColumnWidthsSettled };
}

export type UseAdaptiveGridLayoutOptions = {
	forceFullWidth?: boolean;
	/** Fired after header-wheel column resize settles (debounced). */
	onUserColumnWidthsSettled?: (api: GridApi) => void;
};

/** Desktop-only: shrink-wrap when columns fit; skipAutoSize keeps user column widths. */
export function useAdaptiveGridLayout(
	enabled: boolean,
	options?: UseAdaptiveGridLayoutOptions,
) {
	const forceFullWidth = options?.forceFullWidth ?? false;
	const onUserColumnWidthsSettledRef = useRef(
		options?.onUserColumnWidthsSettled,
	);
	onUserColumnWidthsSettledRef.current = options?.onUserColumnWidthsSettled;
	const shellRef = useRef<HTMLDivElement | null>(null);
	const wrapRef = useRef<HTMLDivElement | null>(null);
	const [layoutMode, setLayoutMode] =
		useState<AdaptiveGridLayoutMode>('full');

	const applyingRef = useRef(false);
	const apiRef = useRef<GridApi | null>(null);
	const wheelFinishTimerRef = useRef<number | null>(null);
	const lastResultRef = useRef<AdaptiveGridLayoutResult>({
		mode: 'full',
		compactWidth: null,
	});

	const apply = useCallback(
		(api: GridApi, applyOptions?: ApplyAdaptiveGridLayoutOptions) => {
			apiRef.current = api;
			if (applyingRef.current) {
				gridLayoutLog('adaptive.apply.reentry-skip', {
					reason: applyOptions?.debugReason ?? null,
					skipAutoSize: applyOptions?.skipAutoSize === true,
					forceFullWidth,
					lastResult: lastResultRef.current,
				});
				return lastResultRef.current;
			}
			applyingRef.current = true;
			try {
				if (!enabled) {
					gridLayoutLog('adaptive.apply.disabled-sizeToFit', {
						reason: applyOptions?.debugReason ?? null,
					});
					api.sizeColumnsToFit();
					if (wrapRef.current) setWrapLayout(wrapRef.current, 'full', null);
					const result = { mode: 'full' as const, compactWidth: null };
					lastResultRef.current = result;
					queueMicrotask(() => {
						setLayoutMode((prev) => (prev === 'full' ? prev : 'full'));
					});
					return result;
				}
				const prevMode = lastResultRef.current.mode;
				const result = applyAdaptiveGridLayout(
					api,
					shellRef.current,
					wrapRef.current,
					{ ...applyOptions, forceFullWidth },
				);
				if (prevMode !== result.mode) {
					gridLayoutLog('adaptive.mode-change', {
						reason: applyOptions?.debugReason ?? null,
						from: prevMode,
						to: result.mode,
						forceFullWidth,
						skipAutoSize: applyOptions?.skipAutoSize === true,
					});
				}
				lastResultRef.current = result;
				const nextMode = result.mode;
				queueMicrotask(() => {
					setLayoutMode((prev) => (prev === nextMode ? prev : nextMode));
				});
				return result;
			} finally {
				applyingRef.current = false;
			}
		},
		[enabled, forceFullWidth],
	);

	useEffect(() => {
		gridLayoutLog('adaptive.forceFullWidth', {
			enabled,
			forceFullWidth,
			layoutMode: lastResultRef.current.mode,
		});
	}, [enabled, forceFullWidth]);

	useEffect(() => {
		if (!enabled) return;

		const onWheel = (event: WheelEvent) => {
			if (event.ctrlKey || event.metaKey) return;
			const wrap = wrapRef.current;
			const api = apiRef.current;
			if (!wrap || !api) return;
			if (!isGridHeaderWheelEvent(event, wrap)) return;
			event.preventDefault();
			event.stopPropagation();
			const colId = headerCellColIdFromEvent(event, wrap);
			if (!colId) return;
			const displayed =
				api.getAllDisplayedColumns()?.map((column) => ({
					colId: column.getColId(),
					width: column.getActualWidth(),
					minWidth: column.getMinWidth(),
					maxWidth: column.getMaxWidth(),
				})) ?? [];
			const layoutModeNow = lastResultRef.current.mode;
			const conserveTotal = forceFullWidth;
			const deltaPx = wheelDeltaToWidthPx(event);
			const widths = columnWidthsFromHeaderWheel(
				displayed,
				colId,
				deltaPx,
				{ conserveTotal },
			);
			const shellEl = shellRef.current;
			const currentSum = displayed.reduce((sum, col) => sum + col.width, 0);
			const nextSum = widths
				? columnSumAfterWidthUpdates(displayed, widths)
				: currentSum;
			const maxInner = shellEl ? gridPaneInnerWidth(shellEl, wrap) : null;
			const hitFullWidth = maxInner != null && nextSum > maxInner;
			if (!widths) {
				gridLayoutLog('header-wheel.no-update', {
					colId,
					deltaPx,
					rawDeltaY: event.deltaY,
					rawDeltaX: event.deltaX,
					layoutMode: layoutModeNow,
					conserveTotal,
					forceFullWidth,
					currentSum,
					nextSum,
					maxInner,
					hitFullWidth,
					columns: displayed.map((col) => ({
						id: col.colId,
						w: col.width,
						min: col.minWidth,
						max: col.maxWidth,
					})),
				});
				return;
			}
			const wrapEl = wrap;
			let grewWrap = false;
			applyingRef.current = true;
			try {
				if (!conserveTotal && shellEl) {
					// Grow/shrink the wrap before AG Grid clamps columns to the old box.
					if (
						nextSum !== currentSum &&
						maxInner != null &&
						nextSum > 0 &&
						nextSum <= maxInner
					) {
						setWrapLayout(
							wrapEl,
							'compact',
							compactWrapWidth(nextSum, wrapEl),
						);
						grewWrap = true;
					}
				}
				gridLayoutLog('header-wheel.apply', {
					colId,
					deltaPx,
					rawDeltaY: event.deltaY,
					rawDeltaX: event.deltaX,
					layoutMode: layoutModeNow,
					conserveTotal,
					forceFullWidth,
					currentSum,
					nextSum,
					maxInner,
					gapToFull: maxInner != null ? maxInner - nextSum : null,
					hitFullWidth,
					grewWrap,
					willCallApply: !conserveTotal,
					updates: widths,
					before: displayed.map((col) => ({
						id: col.colId,
						w: col.width,
					})),
				});
				api.setColumnWidths(widths, false);
			} finally {
				applyingRef.current = false;
			}
			if (!conserveTotal) {
				apply(api, {
					skipAutoSize: true,
					debugReason: hitFullWidth
						? 'header-wheel-hit-full-width'
						: 'header-wheel',
				});
			} else {
				gridLayoutLog('header-wheel.skip-apply-conserve', {
					colId,
					layoutMode: layoutModeNow,
					forceFullWidth,
					after: snapshotDisplayedColumns(api),
					columnSum: sumSnapshotWidths(snapshotDisplayedColumns(api)),
				});
			}
			if (wheelFinishTimerRef.current != null) {
				window.clearTimeout(wheelFinishTimerRef.current);
			}
			wheelFinishTimerRef.current = window.setTimeout(() => {
				gridLayoutLog('header-wheel.settled', {
					colId,
					updates: widths,
					layoutMode: lastResultRef.current.mode,
					forceFullWidth,
					after: snapshotGrid(api, shellRef.current, wrapRef.current),
				});
				api.setColumnWidths(widths, true);
				wheelFinishTimerRef.current = null;
				onUserColumnWidthsSettledRef.current?.(api);
			}, 120);
		};

		document.addEventListener('wheel', onWheel, {
			passive: false,
			capture: true,
		});
		return () => {
			document.removeEventListener('wheel', onWheel, true);
			if (wheelFinishTimerRef.current != null) {
				window.clearTimeout(wheelFinishTimerRef.current);
				wheelFinishTimerRef.current = null;
			}
		};
	}, [enabled, apply, forceFullWidth]);

	return {
		shellRef,
		wrapRef,
		layoutMode,
		apply,
	};
}

const emptyDash = <T>(p: ValueFormatterParams<T, string | null>) => {
	const value = p.value ?? '';
	return value.trim() ? value : '—';
};

export type BuiltinTaskColumnField = keyof Pick<
	Task,
	| 'externalKey'
	| 'jobTitle'
	| 'taskType'
	| 'destinationAddress'
	| 'windowStartAt'
	| 'status'
	| 'contactNames'
	| 'crewName'
	| 'windowEndAt'
	| 'description'
	| 'createdByName'
>;

export type CustomFieldColumnField = `cf:${number}`;

export type TaskColumnField = BuiltinTaskColumnField | CustomFieldColumnField;

const CUSTOM_FIELD_COLUMN_PREFIX = 'cf:';

export function customFieldColumnId(slot: number): CustomFieldColumnField {
	return `cf:${slot}`;
}

export function parseCustomFieldColumnId(
	field: string,
): number | null {
	if (!field.startsWith(CUSTOM_FIELD_COLUMN_PREFIX)) return null;
	const slot = Number(field.slice(CUSTOM_FIELD_COLUMN_PREFIX.length));
	return Number.isInteger(slot) && slot >= 1 ? slot : null;
}

export function isBuiltinTaskColumnField(
	field: string,
): field is BuiltinTaskColumnField {
	return ALL_BUILTIN_TASK_COLUMN_FIELDS.has(field as BuiltinTaskColumnField);
}

export type TaskColumnOption = {
	field: TaskColumnField;
	headerName: string;
	required?: boolean;
};

export const REQUIRED_TASK_COLUMNS: BuiltinTaskColumnField[] = ['externalKey'];

export const TASK_COLUMN_OPTIONS: TaskColumnOption[] = [
	{ field: 'externalKey', headerName: 'Job', required: true },
	{ field: 'jobTitle', headerName: 'Title' },
	{ field: 'taskType', headerName: 'Type' },
	{ field: 'destinationAddress', headerName: 'Destination' },
	{ field: 'windowStartAt', headerName: 'Start' },
	{ field: 'status', headerName: 'Status' },
	{ field: 'contactNames', headerName: 'Contacts' },
	{ field: 'crewName', headerName: 'Crew' },
	{ field: 'windowEndAt', headerName: 'End' },
	{ field: 'description', headerName: 'Description' },
	{ field: 'createdByName', headerName: 'Created by' },
];

export const DEFAULT_VISIBLE_TASK_COLUMNS: BuiltinTaskColumnField[] = [
	'externalKey',
	'jobTitle',
	'taskType',
	'destinationAddress',
	'windowStartAt',
];

export const TASK_COLUMNS_STORAGE_KEY = 'field:taskGridColumns';
export const MOBILE_TASK_CARD_COMPACT_KEY = 'field:mobileTaskCardCompact';

export function readMobileTaskCardCompact(): boolean {
	try {
		return localStorage.getItem(MOBILE_TASK_CARD_COMPACT_KEY) === '1';
	} catch {
		return false;
	}
}

export function writeMobileTaskCardCompact(compact: boolean): void {
	try {
		localStorage.setItem(MOBILE_TASK_CARD_COMPACT_KEY, compact ? '1' : '0');
	} catch {
		/* private mode / blocked storage */
	}
}

export const TASK_GRID_COLUMN_STATE_KEY = 'field:taskGridColumnState';

export type TaskGridColumnState = ColumnState[];

function measureBandFromAdaptive(
	adaptiveLayout?: AdaptiveGridLayout,
): GridWidthBand | null {
	if (!adaptiveLayout?.shellRef.current || !adaptiveLayout.wrapRef.current) {
		return null;
	}
	const paneW = gridPaneInnerWidth(
		adaptiveLayout.shellRef.current,
		adaptiveLayout.wrapRef.current,
	);
	return gridWidthBandFromPaneWidth(paneW);
}

const ALL_BUILTIN_TASK_COLUMN_FIELDS = new Set(
	TASK_COLUMN_OPTIONS.map((o) => o.field),
);

function isStoredTaskColumnField(field: string): field is TaskColumnField {
	return (
		ALL_BUILTIN_TASK_COLUMN_FIELDS.has(field as BuiltinTaskColumnField) ||
		parseCustomFieldColumnId(field) != null
	);
}

function withRequiredColumns(fields: TaskColumnField[]): TaskColumnField[] {
	const next = new Set(fields);
	for (const required of REQUIRED_TASK_COLUMNS) {
		next.add(required);
	}
	const builtins = TASK_COLUMN_OPTIONS.map((o) => o.field).filter((f) =>
		next.has(f),
	);
	const custom = fields.filter(
		(f) => parseCustomFieldColumnId(f) != null && next.has(f),
	);
	return [...builtins, ...custom];
}

export function sanitizeVisibleTaskColumns(
	fields: TaskColumnField[],
	customFieldDefs: OrgCustomFieldDef[],
): TaskColumnField[] {
	const validSlots = new Set(
		labeledCustomFieldDefs(customFieldDefs).map((d) => d.slot),
	);
	return fields.filter((field) => {
		const slot = parseCustomFieldColumnId(field);
		if (slot != null) return validSlots.has(slot);
		return isBuiltinTaskColumnField(field);
	});
}

export function readVisibleTaskColumns(): TaskColumnField[] {
	try {
		const raw = localStorage.getItem(TASK_COLUMNS_STORAGE_KEY);
		if (!raw) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		const fields = parsed.filter(
			(f): f is TaskColumnField =>
				typeof f === 'string' && isStoredTaskColumnField(f),
		);
		if (fields.length === 0) return [...DEFAULT_VISIBLE_TASK_COLUMNS];
		return withRequiredColumns(fields);
	} catch {
		return [...DEFAULT_VISIBLE_TASK_COLUMNS];
	}
}

export function writeVisibleTaskColumns(
	fields: TaskColumnField[],
): TaskColumnField[] {
	const next = withRequiredColumns(fields);
	try {
		localStorage.setItem(TASK_COLUMNS_STORAGE_KEY, JSON.stringify(next));
	} catch {
		/* private mode / blocked storage */
	}
	return next;
}

export function getTaskColumnOptions(
	externalKeyLabel = 'Job',
	customFieldDefs: OrgCustomFieldDef[] = [],
): TaskColumnOption[] {
	const builtins = TASK_COLUMN_OPTIONS.map((opt) =>
		opt.field === 'externalKey'
			? { ...opt, headerName: externalKeyLabel }
			: opt,
	);
	const custom = labeledCustomFieldDefs(customFieldDefs).map((def) => ({
		field: customFieldColumnId(def.slot),
		headerName: def.label,
	}));
	return [...builtins, ...custom];
}

const MOBILE_CARD_SETTINGS_HIDDEN_BUILTINS = new Set<BuiltinTaskColumnField>([
	'externalKey',
	'status',
]);

/** Builtin toggles for mobile task cards (header + packed slots + labeled rows). */
export function getMobileTaskCardBuiltinColumnOptions(): TaskColumnOption[] {
	return TASK_COLUMN_OPTIONS.filter(
		(o) => !MOBILE_CARD_SETTINGS_HIDDEN_BUILTINS.has(o.field),
	);
}

function buildExternalKeyColumnDef(
	externalKeyLabel: string,
): ColDef<Task> {
	return {
		field: 'externalKey',
		headerName: externalKeyLabel,
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const trimmed = (p.value ?? '').trim();
			return trimmed || '—';
		},
	};
}

const taskColumnDefsBase: ColDef<Task>[] = [
	buildExternalKeyColumnDef('Job'),
	{
		field: 'jobTitle',
		headerName: 'Title',
		valueFormatter: emptyDash,
	},
	{
		field: 'taskType',
		headerName: 'Type',
		valueFormatter: (p: ValueFormatterParams<Task, string>) => p.value ?? '',
	},
	{
		field: 'destinationAddress',
		headerName: 'Destination',
	},
	{
		field: 'windowStartAt',
		headerName: 'Start',
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
	},
	{
		field: 'status',
		headerName: 'Status',
		cellRenderer: (params: ICellRendererParams<Task, TaskStatus>) => {
			const status = params.value;
			if (!status) return null;
			return createElement(TaskStatusBadge, { status });
		},
	},
	{
		field: 'contactNames',
		headerName: 'Contacts',
		valueFormatter: emptyDash,
	},
	{
		field: 'crewName',
		headerName: 'Crew',
		valueFormatter: emptyDash,
	},
	{
		field: 'windowEndAt',
		headerName: 'End',
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
	},
	{
		field: 'description',
		headerName: 'Description',
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const plain = htmlToPlainText(p.value ?? '');
			return plain || '—';
		},
	},
	{
		field: 'createdByName',
		headerName: 'Created by',
		valueFormatter: (p: ValueFormatterParams<Task, string>) => {
			const name = p.value?.trim();
			if (!name) return '—';
			return formatShortName(name);
		},
	},
];

/** Cancelled tasks show TTL from per-task archiveAt (frozen at cancel). */
function buildCancelledTtlColumnDef(): ColDef<Task> {
	return {
		colId: 'ttl',
		headerName: 'TTL',
		valueGetter: (p) => p.data?.archiveAt ?? null,
		cellRenderer: (params: ICellRendererParams<Task, string | null>) =>
			createElement(RelativeTime, {
				value: params.value ?? null,
				variant: 'ago',
			}),
		sortable: true,
	};
}

/**
 * One grid column for a custom field. `resolveDef` lets tasks render historical
 * rows against their frozen snapshot; master-data grids always use live defs.
 *
 * Column ids stay `cf:{slot}` — slots are scoped per entity and each entity has
 * its own grid, so there is no collision to disambiguate.
 */
function customFieldDateTimeValue(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return null;
	return `${m[1]}-${m[2]}-${m[3]}T12:00:00`;
}

function buildCustomFieldColumnDef<T extends Partial<WithCustomFields>>(
	def: OrgCustomFieldDef,
	resolveDef?: (row: T) => OrgCustomFieldDef,
): ColDef<T> {
	const slot = String(def.slot);
	const shared: ColDef<T> = {
		colId: customFieldColumnId(def.slot),
		headerName: def.label,
		cellClass: (p) =>
			isCustomFieldUndefined(p.data?.customFields?.[slot])
				? 'field-custom-field-undefined'
				: '',
	};

	if (def.dataType === 'date') {
		return {
			...shared,
			valueGetter: (p) => p.data?.customFields?.[slot] ?? '',
			cellRenderer: (params: ICellRendererParams<T, CustomFieldValue>) => {
				const raw = params.value;
				if (isCustomFieldUndefined(raw)) return '—';
				const dateTime = customFieldDateTimeValue(raw);
				if (!dateTime) return '—';
				return createElement(RelativeTime, {
					value: dateTime,
					variant: 'absolute',
				});
			},
		};
	}

	return {
		...shared,
		valueGetter: (p) => {
			const row = p.data;
			if (!row) return '';
			return formatCustomFieldValue(
				resolveDef?.(row) ?? def,
				row.customFields?.[slot],
				row.customFieldDisplays?.[slot],
			);
		},
		valueFormatter: (p: ValueFormatterParams<T, string>) => {
			const value = p.value ?? '';
			return value.trim() ? value : '—';
		},
	};
}

/** Custom field columns appended to a master-data grid (users, contacts, addresses). */
export function entityCustomFieldColumnDefs<T extends Partial<WithCustomFields>>(
	defs: OrgCustomFieldDef[],
): ColDef<T>[] {
	return labeledCustomFieldDefs(defs).map((def) =>
		buildCustomFieldColumnDef<T>(def),
	);
}

/** Full task column catalog (defaults visible until `getTaskColumnDefs` applies prefs). */
export const taskColumnDefs: ColDef<Task>[] = taskColumnDefsBase;

export function getTaskColumnDefs(
	visibleFields: readonly TaskColumnField[],
	opts?: {
		showCancelledTtl?: boolean;
		externalKeyLabel?: string;
		customFieldDefs?: OrgCustomFieldDef[];
		/** When true, do not inject REQUIRED_TASK_COLUMNS (mobile All Tasks fixed set). */
		fixedVisibleFields?: boolean;
	},
): ColDef<Task>[] {
	const visible = new Set(
		opts?.fixedVisibleFields
			? visibleFields
			: withRequiredColumns([...visibleFields]),
	);
	const externalKeyLabel = opts?.externalKeyLabel ?? 'Job';
	const customDefs = labeledCustomFieldDefs(opts?.customFieldDefs ?? []);
	const baseCols = taskColumnDefsBase.map((col) => {
		if (col.field === 'externalKey') {
			return buildExternalKeyColumnDef(externalKeyLabel);
		}
		return col;
	});
	const cols = baseCols.map((col) => {
		const field = col.field as BuiltinTaskColumnField | undefined;
		if (!field) return col;
		return {
			...col,
			hide: !visible.has(field),
		};
	});
	for (const def of customDefs) {
		cols.push({
			...buildCustomFieldColumnDef<Task>(def, (task) =>
				task.customFieldDefs?.find((d) => d.slot === def.slot) ?? def,
			),
			hide: !visible.has(customFieldColumnId(def.slot)),
		});
	}
	if (opts?.showCancelledTtl) {
		cols.unshift(buildCancelledTtlColumnDef());
	}
	return cols;
}

export const addressColumnDefs: ColDef<Address>[] = [
	{
		field: 'addressName',
		headerName: 'Name',
		valueFormatter: emptyDash,
		minWidth: 100,
	},
	{
		field: 'streetLine',
		headerName: 'Street',
		minWidth: 120,
	},
	{
		field: 'building',
		headerName: 'Building',
		valueFormatter: emptyDash,
		minWidth: 80,
	},
	{
		field: 'notes',
		headerName: 'Notes',
		valueFormatter: emptyDash,
		minWidth: 100,
	},
	{
		colId: 'locationStatus',
		headerName: 'Location',
		minWidth: 88,
		valueGetter: (params) =>
			params.data && hasDestinationCoords(params.data) ? 'set' : 'missing',
		valueFormatter: (params) =>
			params.value === 'set' ? 'Set' : 'Missing',
	},
];

export const contactColumnDefs: ColDef<Contact>[] = [
	{
		field: 'name',
		headerName: 'Contact',
		minWidth: 100,
	},
	{
		field: 'title',
		headerName: 'Title',
		valueFormatter: emptyDash,
		minWidth: 100,
	},
	{
		field: 'phone',
		headerName: 'Phone',
		valueFormatter: emptyDash,
		minWidth: 88,
	},
	{
		field: 'email',
		headerName: 'Email',
		valueFormatter: emptyDash,
		minWidth: 100,
	},
];

export type EntityColumnOption = {
	field: string;
	headerName: string;
	required?: boolean;
};

export const CONTACT_COLUMN_OPTIONS: EntityColumnOption[] = [
	{ field: 'name', headerName: 'Contact', required: true },
	{ field: 'title', headerName: 'Title' },
	{ field: 'phone', headerName: 'Phone' },
	{ field: 'email', headerName: 'Email' },
];

export const ADDRESS_COLUMN_OPTIONS: EntityColumnOption[] = [
	{ field: 'addressName', headerName: 'Name', required: true },
	{ field: 'streetLine', headerName: 'Street' },
	{ field: 'building', headerName: 'Building' },
	{ field: 'notes', headerName: 'Notes' },
	{ field: 'locationStatus', headerName: 'Location' },
];

export const USER_COLUMN_OPTIONS: EntityColumnOption[] = [
	{ field: 'displayName', headerName: 'Name', required: true },
	{ field: 'email', headerName: 'Email' },
	{ field: 'phone', headerName: 'Phone' },
	{ field: 'role', headerName: 'Role' },
];

export const userDataColumnDefs: ColDef<AppUser>[] = [
	{
		field: 'displayName',
		headerName: 'Name',
		minWidth: 140,
	},
	{
		field: 'email',
		headerName: 'Email',
		minWidth: 160,
		valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
			p.value?.trim() ? p.value : '—',
	},
	{
		field: 'phone',
		headerName: 'Phone',
		minWidth: 110,
		valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
			p.value?.trim() ? p.value : '—',
	},
	{
		field: 'role',
		headerName: 'Role',
		minWidth: 100,
		valueFormatter: (p: ValueFormatterParams<AppUser, string>) =>
			p.value?.trim() ? p.value : '—',
	},
];

export const CONTACT_GRID_COLUMNS_STORAGE_KEY = 'field:contactGridColumns';
export const ADDRESS_GRID_COLUMNS_STORAGE_KEY = 'field:addressGridColumns';
export const USER_GRID_COLUMNS_STORAGE_KEY = 'field:userGridColumns';

function entityColumnId(col: ColDef): string {
	return String(col.colId ?? col.field ?? '');
}

function requiredEntityFields(options: EntityColumnOption[]): string[] {
	return options.filter((o) => o.required).map((o) => o.field);
}

function defaultVisibleEntityFields(options: EntityColumnOption[]): string[] {
	return options.map((o) => o.field);
}

function withRequiredEntityFields(
	fields: string[],
	options: EntityColumnOption[],
): string[] {
	const required = new Set(requiredEntityFields(options));
	const next = new Set(fields);
	for (const field of required) next.add(field);
	const builtins = options.map((o) => o.field).filter((f) => next.has(f));
	const custom = fields.filter(
		(f) => parseCustomFieldColumnId(f) != null && next.has(f),
	);
	return [...builtins, ...custom];
}

export function sanitizeVisibleEntityColumns(
	fields: string[],
	options: EntityColumnOption[],
	customFieldDefs: OrgCustomFieldDef[],
): string[] {
	const validSlots = new Set(
		labeledCustomFieldDefs(customFieldDefs).map((d) => d.slot),
	);
	const allowedBuiltins = new Set(options.map((o) => o.field));
	const filtered = fields.filter((field) => {
		const slot = parseCustomFieldColumnId(field);
		if (slot != null) return validSlots.has(slot);
		return allowedBuiltins.has(field);
	});
	return withRequiredEntityFields(
		filtered.length > 0 ? filtered : defaultVisibleEntityFields(options),
		options,
	);
}

export function readVisibleEntityColumns(
	storageKey: string,
	options: EntityColumnOption[],
	customFieldDefs: OrgCustomFieldDef[] = [],
): string[] {
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) {
			return withRequiredEntityFields(
				defaultVisibleEntityFields(options),
				options,
			);
		}
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return withRequiredEntityFields(
				defaultVisibleEntityFields(options),
				options,
			);
		}
		const fields = parsed.filter((f): f is string => typeof f === 'string');
		return sanitizeVisibleEntityColumns(fields, options, customFieldDefs);
	} catch {
		return withRequiredEntityFields(
			defaultVisibleEntityFields(options),
			options,
		);
	}
}

export function writeVisibleEntityColumns(
	storageKey: string,
	fields: string[],
	options: EntityColumnOption[],
): string[] {
	const next = withRequiredEntityFields(fields, options);
	try {
		localStorage.setItem(storageKey, JSON.stringify(next));
	} catch {
		/* private mode / blocked storage */
	}
	return next;
}

export function getEntityColumnOptions(
	builtinOptions: EntityColumnOption[],
	customFieldDefs: OrgCustomFieldDef[] = [],
): EntityColumnOption[] {
	const custom = labeledCustomFieldDefs(customFieldDefs).map((def) => ({
		field: customFieldColumnId(def.slot),
		headerName: def.label,
	}));
	return [...builtinOptions, ...custom];
}

export function buildEntityGridColumnDefs<T extends Partial<WithCustomFields>>(
	baseCols: ColDef<T>[],
	customFieldDefs: OrgCustomFieldDef[],
	visibleFields: readonly string[],
	options: EntityColumnOption[],
	trailingCols: ColDef<T>[] = [],
): ColDef<T>[] {
	const visible = new Set(withRequiredEntityFields([...visibleFields], options));
	const dataCols = baseCols.map((col) => {
		const id = entityColumnId(col);
		return { ...col, hide: !visible.has(id) };
	});
	const customCols = entityCustomFieldColumnDefs<T>(customFieldDefs).map(
		(col) => {
			const id = entityColumnId(col);
			return { ...col, hide: !visible.has(id) };
		},
	);
	return [...dataCols, ...customCols, ...trailingCols];
}

export type GridColumnVisibilityPrefs = {
	visibleFields: readonly string[];
	pinnedColIds?: readonly string[];
	isTogglableColumn: (colId: string) => boolean;
};

export function mergeGridColumnVisibility(
	saved: ColumnState[],
	prefs: GridColumnVisibilityPrefs,
): ColumnState[] {
	const visible = new Set(prefs.visibleFields);
	const pinned = new Set(prefs.pinnedColIds ?? []);
	return saved.map((col) => {
		const id = col.colId;
		if (!id || pinned.has(id) || !prefs.isTogglableColumn(id)) return col;
		return { ...col, hide: !visible.has(id) };
	});
}

export function useEntityGridColumnPicker(
	storageKey: string,
	builtinOptions: EntityColumnOption[],
	customFieldDefs: OrgCustomFieldDef[],
) {
	const allOptions = useMemo(
		() => getEntityColumnOptions(builtinOptions, customFieldDefs),
		[builtinOptions, customFieldDefs],
	);
	const togglableColIds = useMemo(
		() => new Set(allOptions.map((o) => o.field)),
		[allOptions],
	);
	const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
		readVisibleEntityColumns(storageKey, builtinOptions, customFieldDefs),
	);

	useEffect(() => {
		setVisibleColumns((prev) =>
			sanitizeVisibleEntityColumns(prev, builtinOptions, customFieldDefs),
		);
	}, [builtinOptions, customFieldDefs]);

	const toggleColumn = useCallback(
		(field: string, checked: boolean) => {
			const option = allOptions.find((o) => o.field === field);
			if (option?.required) return;
			setVisibleColumns((prev) =>
				writeVisibleEntityColumns(
					storageKey,
					checked ? [...prev, field] : prev.filter((f) => f !== field),
					builtinOptions,
				),
			);
		},
		[storageKey, allOptions, builtinOptions],
	);

	const builtinColumnOptions = useMemo(
		() => allOptions.filter((o) => parseCustomFieldColumnId(o.field) == null),
		[allOptions],
	);
	const customColumnOptions = useMemo(
		() => allOptions.filter((o) => parseCustomFieldColumnId(o.field) != null),
		[allOptions],
	);

	const columnVisibility = useMemo<GridColumnVisibilityPrefs>(
		() => ({
			visibleFields: visibleColumns,
			pinnedColIds: ['actions'],
			isTogglableColumn: (id) => togglableColIds.has(id),
		}),
		[visibleColumns, togglableColIds],
	);

	return {
		visibleColumns,
		toggleColumn,
		builtinColumnOptions,
		customColumnOptions,
		columnVisibility,
	};
}

export function taskColumnHiddenByPrefs(
	colId: string | null | undefined,
	visibleFields: ReadonlySet<TaskColumnField>,
	showCancelledTtl: boolean,
): boolean {
	if (!colId) return true;
	if (colId === 'ttl') return !showCancelledTtl;
	const slot = parseCustomFieldColumnId(colId);
	if (slot != null) return !visibleFields.has(customFieldColumnId(slot));
	if (isBuiltinTaskColumnField(colId)) {
		return !visibleFields.has(colId);
	}
	return true;
}

export function mergeTaskGridColumnState(
	saved: TaskGridColumnState,
	visibleFields: readonly TaskColumnField[],
	showCancelledTtl: boolean,
): TaskGridColumnState {
	const visible = new Set(visibleFields);
	return saved.map((col) => ({
		...col,
		hide: taskColumnHiddenByPrefs(col.colId, visible, showCancelledTtl),
	}));
}

export function readTaskGridColumnLayout(): BandedGridColumnLayoutV2 | null {
	try {
		const raw = localStorage.getItem(TASK_GRID_COLUMN_STATE_KEY);
		if (!raw) return null;
		return parseBandedGridColumnLayout(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function writeTaskGridColumnLayout(
	layout: BandedGridColumnLayoutV2,
): void {
	try {
		localStorage.setItem(TASK_GRID_COLUMN_STATE_KEY, JSON.stringify(layout));
	} catch {
		/* private mode / blocked storage */
	}
}

/** Bake saved column layout into first paint — avoids post-mount applyColumnState shift. */
export function buildPartialInitialStateFromColumnState(
	columnState: ColumnState[],
): GridState {
	return {
		partialColumnState: true,
		...convertColumnState(columnState),
	};
}

export function getTaskGridInitialState(
	visibleFields: readonly TaskColumnField[],
	showCancelledTtl: boolean,
	paneWidthPx = estimatePaneWidthFromWindow(),
): GridState | undefined {
	const layout = readTaskGridColumnLayout();
	if (!layout) return undefined;
	const band = gridWidthBandFromPaneWidth(paneWidthPx);
	if (!bandHasSavedWidths(layout, band)) return undefined;
	const columnState = mergeTaskGridColumnState(
		buildColumnStateForBand(layout, band),
		visibleFields,
		showCancelledTtl,
	);
	return buildPartialInitialStateFromColumnState(columnState);
}

function applyTaskGridColumnStateForBand(
	api: GridApi,
	visibleFields: readonly TaskColumnField[],
	showCancelledTtl: boolean,
	band: GridWidthBand,
): boolean {
	const layout = readTaskGridColumnLayout();
	if (!layout || !bandHasSavedWidths(layout, band)) return false;
	api.applyColumnState({
		state: mergeTaskGridColumnState(
			buildColumnStateForBand(layout, band),
			visibleFields,
			showCancelledTtl,
		),
		applyOrder: true,
	});
	return true;
}

function saveTaskGridSharedLayout(api: GridApi): void {
	const columnState = api.getColumnState();
	const layout =
		readTaskGridColumnLayout() ?? emptyBandedGridColumnLayout(columnState);
	writeTaskGridColumnLayout(updateSharedLayoutFromApi(layout, columnState));
}

function saveTaskGridUserBandWidths(
	api: GridApi,
	band: GridWidthBand,
): void {
	const columnState = api.getColumnState();
	let layout =
		readTaskGridColumnLayout() ?? emptyBandedGridColumnLayout(columnState);
	layout = updateSharedLayoutFromApi(layout, columnState);
	layout = updateBandWidthsFromApi(layout, band, columnState);
	writeTaskGridColumnLayout(layout);
}

/**
 * Desktop task list: persist column width, order, and sort in localStorage.
 * Visibility still comes from the column picker (`readVisibleTaskColumns`).
 */
export function usePersistedTaskGridColumns(
	enabled: boolean,
	visibleFields: readonly TaskColumnField[],
	showCancelledTtl: boolean,
	adaptiveLayout?: AdaptiveGridLayout,
	userWidthsSaveRef?: MutableRefObject<(api: GridApi) => void>,
) {
	const visibleFieldsRef = useRef(visibleFields);
	const showCancelledTtlRef = useRef(showCancelledTtl);
	visibleFieldsRef.current = visibleFields;
	showCancelledTtlRef.current = showCancelledTtl;

	const activeBandRef = useRef<GridWidthBand | null>(null);
	const lastPaneInnerRef = useRef<number | null>(null);
	const adaptiveLayoutRef = useRef(adaptiveLayout);
	adaptiveLayoutRef.current = adaptiveLayout;

	const resolveBand = useCallback((): GridWidthBand => {
		return (
			measureBandFromAdaptive(adaptiveLayoutRef.current) ??
			gridWidthBandFromPaneWidth(estimatePaneWidthFromWindow())
		);
	}, []);

	const skipAutoSizeForCurrentBand = useCallback((): boolean => {
		const layout = readTaskGridColumnLayout();
		const band = activeBandRef.current ?? resolveBand();
		return layout != null && bandHasSavedWidths(layout, band);
	}, [resolveBand]);

	const applyBandColumnState = useCallback(
		(api: GridApi, band: GridWidthBand): boolean => {
			return applyTaskGridColumnStateForBand(
				api,
				visibleFieldsRef.current,
				showCancelledTtlRef.current,
				band,
			);
		},
		[],
	);

	const syncBandColumnStateFixed = useCallback(
		(api: GridApi): boolean => {
			const band = resolveBand();
			const prev = activeBandRef.current;
			activeBandRef.current = band;
			if (prev === band) return false;
			return applyBandColumnState(api, band);
		},
		[resolveBand, applyBandColumnState],
	);

	const runAdaptiveLayout = useCallback(
		(api: GridApi) => {
			const forceFull = getGridForceFullWidth();
			const skipAutoSize = forceFull ? false : skipAutoSizeForCurrentBand();
			const layoutApi = adaptiveLayoutRef.current;
			gridLayoutLog('taskGrid.runAdaptiveLayout', {
				forceFull,
				skipAutoSize,
				hasAdaptive: Boolean(layoutApi),
				willSizeColumnsToFit: forceFull || !skipAutoSize,
				before: snapshotDisplayedColumns(api),
			});
			if (layoutApi) {
				const band = activeBandRef.current ?? resolveBand();
				const layout = readTaskGridColumnLayout();
				layoutApi.apply(
					api,
					forceFull
						? {
								skipAutoSize,
								debugReason: 'taskGrid.runAdaptiveLayout.forceFull',
							}
						: adaptiveApplyOptionsForSavedBand(
								api,
								layout,
								band,
								skipAutoSize,
								'taskGrid.runAdaptiveLayout',
							),
				);
			} else if (forceFull || !skipAutoSizeForCurrentBand()) {
				gridLayoutLog('taskGrid.runAdaptiveLayout.sizeColumnsToFit', {
					forceFull,
				});
				api.sizeColumnsToFit();
			}
		},
		[skipAutoSizeForCurrentBand, resolveBand],
	);

	const applyLayoutAfterUserColumnResize = useCallback(
		(api: GridApi) => {
			gridLayoutLog('taskGrid.afterUserColumnResize', {
				before: snapshotDisplayedColumns(api),
			});
			const band = activeBandRef.current ?? resolveBand();
			const layout = readTaskGridColumnLayout();
			adaptiveLayoutRef.current?.apply(
				api,
				adaptiveApplyOptionsForSavedBand(
					api,
					layout,
					band,
					true,
					'taskGrid.afterUserColumnResize',
				),
			);
		},
		[resolveBand],
	);

	const initialState = useMemo(() => {
		if (!enabled) return undefined;
		return getTaskGridInitialState(visibleFields, showCancelledTtl);
	}, [enabled, visibleFields, showCancelledTtl]);

	const saveUserBandWidths = useCallback(
		(api: GridApi) => {
			if (!enabled) return;
			const band = resolveBand();
			activeBandRef.current = band;
			gridLayoutLog('taskGrid.saveUserBandWidths', {
				band,
				columns: snapshotDisplayedColumns(api),
			});
			saveTaskGridUserBandWidths(api, band);
		},
		[enabled, resolveBand],
	);

	useEffect(() => {
		if (!userWidthsSaveRef) return;
		userWidthsSaveRef.current = saveUserBandWidths;
	}, [userWidthsSaveRef, saveUserBandWidths]);

	const apply = useCallback(
		(api: GridApi) => {
			if (!enabled) return;
			const band = resolveBand();
			activeBandRef.current = band;
			const restored = applyBandColumnState(api, band);
			if (!restored) {
				runAdaptiveLayout(api);
			} else {
				runAdaptiveLayout(api);
			}
		},
		[enabled, resolveBand, applyBandColumnState, runAdaptiveLayout],
	);

	const onGridReady = useCallback(
		(event: GridReadyEvent) => {
			if (initialState) return;
			apply(event.api);
		},
		[apply, initialState],
	);

	const onFirstDataRendered = useCallback(
		(event: { api: GridApi }) => {
			if (initialState) {
				const band = resolveBand();
				activeBandRef.current = band;
				runAdaptiveLayout(event.api);
				return;
			}
			apply(event.api);
		},
		[apply, initialState, resolveBand, runAdaptiveLayout],
	);

	const onColumnResized = useCallback(
		(event: ColumnResizedEvent) => {
			if (!enabled || !event.finished) return;
			const isUser = isUserColumnResizeEvent(event);
			gridLayoutLog('taskGrid.onColumnResized', {
				source: event.source,
				finished: event.finished,
				isUser,
				resized: event.columns?.map((col) => ({
					id: col.getColId(),
					w: col.getActualWidth(),
				})),
				columns: snapshotDisplayedColumns(event.api),
			});
			if (!isUser) {
				return;
			}
			saveUserBandWidths(event.api);
			applyLayoutAfterUserColumnResize(event.api);
		},
		[
			enabled,
			saveUserBandWidths,
			applyLayoutAfterUserColumnResize,
		],
	);

	const onColumnMoved = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveTaskGridSharedLayout(event.api);
		},
		[enabled],
	);

	const onSortChanged = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveTaskGridSharedLayout(event.api);
		},
		[enabled],
	);

	const onColumnDefsChanged = useCallback(
		(api: GridApi | null) => {
			if (!api || !enabled) return;
			apply(api);
		},
		[enabled, apply],
	);

	const onGridSizeChanged = useCallback(
		(event: { api: GridApi; clientWidth?: number; clientHeight?: number }) => {
			const layoutApi = adaptiveLayoutRef.current;
			if (!layoutApi) return;
			const wrapEl = layoutApi.wrapRef.current;
			const { skip, pane } = shouldSkipWrapOnlyGridSizeChange(
				lastPaneInnerRef,
				layoutApi.shellRef.current,
				wrapEl,
			);
			gridLayoutLog('taskGrid.onGridSizeChanged', {
				clientWidth: event.clientWidth ?? null,
				clientHeight: event.clientHeight ?? null,
				pane,
				skip,
				band: activeBandRef.current,
				before: snapshotDisplayedColumns(event.api),
			});
			if (skip) return;
			queueMicrotask(() => {
				const bandChanged = syncBandColumnStateFixed(event.api);
				gridLayoutLog('taskGrid.onGridSizeChanged.microtask', {
					bandChanged,
					band: activeBandRef.current,
				});
				runAdaptiveLayout(event.api);
			});
		},
		[syncBandColumnStateFixed, runAdaptiveLayout],
	);

	return {
		initialState,
		onGridReady,
		onFirstDataRendered,
		onGridSizeChanged: adaptiveLayout ? onGridSizeChanged : undefined,
		onColumnResized,
		onColumnMoved,
		onSortChanged,
		onColumnDefsChanged,
	};
}

export type GridSessionId =
	| 'addresses'
	| 'contacts'
	| 'users'
	| 'dev-tests'
	| 'dev-scripts';

export type GridSessionState = {
	columnLayout?: BandedGridColumnLayoutV2;
	filterModel?: FilterModel | null;
};

type LegacyGridSessionState = GridSessionState & {
	columnState?: ColumnState[];
};

function normalizeGridSessionState(
	saved: LegacyGridSessionState,
): GridSessionState | null {
	if (!saved || typeof saved !== 'object') return null;
	if (saved.columnLayout) {
		return {
			columnLayout: saved.columnLayout,
			filterModel: saved.filterModel ?? null,
		};
	}
	if (saved.columnState?.length) {
		const columnLayout =
			parseBandedGridColumnLayout(saved.columnState) ?? undefined;
		return {
			...(columnLayout ? { columnLayout } : {}),
			filterModel: saved.filterModel ?? null,
		};
	}
	if (saved.filterModel != null) {
		return { filterModel: saved.filterModel };
	}
	return null;
}

export function readGridSessionState(
	gridId: GridSessionId,
): GridSessionState | null {
	const saved = readPageState<LegacyGridSessionState | null>(
		`grid:${gridId}`,
		null,
	);
	return normalizeGridSessionState(saved ?? {});
}

export function writeGridSessionState(
	gridId: GridSessionId,
	state: GridSessionState,
): void {
	writePageState(`grid:${gridId}`, state);
}

function sessionColumnStateForBand(
	state: GridSessionState,
	band: GridWidthBand,
	columnVisibility?: GridColumnVisibilityPrefs,
): ColumnState[] | null {
	const layout = state.columnLayout;
	if (!layout || !bandHasSavedWidths(layout, band)) return null;
	const columnState = buildColumnStateForBand(layout, band);
	if (!columnVisibility) return columnState;
	return mergeGridColumnVisibility(columnState, columnVisibility);
}

function applyGridSessionState(
	api: GridApi,
	state: GridSessionState,
	band: GridWidthBand,
	columnVisibility?: GridColumnVisibilityPrefs,
): boolean {
	const columnState = sessionColumnStateForBand(state, band, columnVisibility);
	if (columnState?.length) {
		api.applyColumnState({ state: columnState, applyOrder: true });
	}
	if (state.filterModel != null) {
		api.setFilterModel(state.filterModel);
	}
	return columnState != null && columnState.length > 0;
}

export function getGridSessionInitialState(
	gridId: GridSessionId,
	columnVisibility?: GridColumnVisibilityPrefs,
	paneWidthPx = estimatePaneWidthFromWindow(),
): GridState | undefined {
	const saved = readGridSessionState(gridId);
	if (!saved) return undefined;

	const initialState: GridState = {};
	const band = gridWidthBandFromPaneWidth(paneWidthPx);
	const columnState = sessionColumnStateForBand(
		saved,
		band,
		columnVisibility,
	);
	if (columnState?.length) {
		Object.assign(
			initialState,
			buildPartialInitialStateFromColumnState(columnState),
		);
	}
	if (saved.filterModel != null) {
		initialState.filter = { filterModel: saved.filterModel };
	}
	if (!columnState?.length && saved.filterModel == null) return undefined;
	return initialState;
}

function saveGridSessionSharedLayout(api: GridApi, gridId: GridSessionId): void {
	const columnState = api.getColumnState();
	const prev = readGridSessionState(gridId);
	let layout =
		prev?.columnLayout ?? emptyBandedGridColumnLayout(columnState);
	layout = updateSharedLayoutFromApi(layout, columnState);
	writeGridSessionState(gridId, {
		columnLayout: layout,
		filterModel: prev?.filterModel ?? null,
	});
}

function saveGridSessionUserBandWidths(
	api: GridApi,
	gridId: GridSessionId,
	band: GridWidthBand,
): void {
	const columnState = api.getColumnState();
	const prev = readGridSessionState(gridId);
	let layout =
		prev?.columnLayout ?? emptyBandedGridColumnLayout(columnState);
	layout = updateSharedLayoutFromApi(layout, columnState);
	layout = updateBandWidthsFromApi(layout, band, columnState);
	writeGridSessionState(gridId, {
		columnLayout: layout,
		filterModel: prev?.filterModel ?? null,
	});
}

function saveGridSessionFilter(api: GridApi, gridId: GridSessionId): void {
	const prev = readGridSessionState(gridId);
	writeGridSessionState(gridId, {
		columnLayout: prev?.columnLayout,
		filterModel: api.getFilterModel(),
	});
}

/** Desktop-only: restore AG Grid sort/filter from sessionStorage across page navigation. */
export function usePersistedAgGridSession(
	gridId: GridSessionId,
	enabled: boolean,
	adaptiveLayout?: AdaptiveGridLayout,
	columnVisibility?: GridColumnVisibilityPrefs,
	userWidthsSaveRef?: MutableRefObject<(api: GridApi) => void>,
) {
	const columnVisibilityRef = useRef(columnVisibility);
	columnVisibilityRef.current = columnVisibility;

	const activeBandRef = useRef<GridWidthBand | null>(null);
	const lastPaneInnerRef = useRef<number | null>(null);
	const adaptiveLayoutRef = useRef(adaptiveLayout);
	adaptiveLayoutRef.current = adaptiveLayout;

	const resolveBand = useCallback((): GridWidthBand => {
		return (
			measureBandFromAdaptive(adaptiveLayoutRef.current) ??
			gridWidthBandFromPaneWidth(estimatePaneWidthFromWindow())
		);
	}, []);

	const skipAutoSizeForCurrentBand = useCallback((): boolean => {
		const saved = readGridSessionState(gridId);
		const band = activeBandRef.current ?? resolveBand();
		return (
			saved?.columnLayout != null &&
			bandHasSavedWidths(saved.columnLayout, band)
		);
	}, [gridId, resolveBand]);

	const runAdaptiveLayout = useCallback(
		(api: GridApi) => {
			const forceFull = getGridForceFullWidth();
			const skipAutoSize = forceFull ? false : skipAutoSizeForCurrentBand();
			const layoutApi = adaptiveLayoutRef.current;
			gridLayoutLog('session.runAdaptiveLayout', {
				gridId,
				forceFull,
				skipAutoSize,
				hasAdaptive: Boolean(layoutApi),
				willSizeColumnsToFit: forceFull || !skipAutoSize,
				before: snapshotDisplayedColumns(api),
			});
			if (layoutApi) {
				const band = activeBandRef.current ?? resolveBand();
				const layout = readGridSessionState(gridId)?.columnLayout ?? null;
				layoutApi.apply(
					api,
					forceFull
						? {
								skipAutoSize,
								debugReason: `session.runAdaptiveLayout.forceFull:${gridId}`,
							}
						: adaptiveApplyOptionsForSavedBand(
								api,
								layout,
								band,
								skipAutoSize,
								`session.runAdaptiveLayout:${gridId}`,
							),
				);
			} else if (forceFull || !skipAutoSizeForCurrentBand()) {
				gridLayoutLog('session.runAdaptiveLayout.sizeColumnsToFit', {
					gridId,
					forceFull,
				});
				api.sizeColumnsToFit();
			}
		},
		[skipAutoSizeForCurrentBand, gridId, resolveBand],
	);

	const applyLayoutAfterUserColumnResize = useCallback(
		(api: GridApi) => {
			gridLayoutLog('session.afterUserColumnResize', {
				gridId,
				before: snapshotDisplayedColumns(api),
			});
			const band = activeBandRef.current ?? resolveBand();
			const layout = readGridSessionState(gridId)?.columnLayout ?? null;
			adaptiveLayoutRef.current?.apply(
				api,
				adaptiveApplyOptionsForSavedBand(
					api,
					layout,
					band,
					true,
					`session.afterUserColumnResize:${gridId}`,
				),
			);
		},
		[gridId, resolveBand],
	);

	const applyBandColumnState = useCallback(
		(api: GridApi, band: GridWidthBand): boolean => {
			const saved = readGridSessionState(gridId);
			if (!saved) return false;
			return applyGridSessionState(
				api,
				saved,
				band,
				columnVisibilityRef.current,
			);
		},
		[gridId],
	);

	const syncBandColumnState = useCallback(
		(api: GridApi): boolean => {
			const band = resolveBand();
			const prev = activeBandRef.current;
			activeBandRef.current = band;
			if (prev === band) return false;
			return applyBandColumnState(api, band);
		},
		[resolveBand, applyBandColumnState],
	);

	const initialState = useMemo(() => {
		if (!enabled) return undefined;
		return getGridSessionInitialState(gridId, columnVisibility);
	}, [enabled, gridId, columnVisibility]);

	const saveUserBandWidths = useCallback(
		(api: GridApi) => {
			if (!enabled) return;
			const band = resolveBand();
			activeBandRef.current = band;
			gridLayoutLog('session.saveUserBandWidths', {
				gridId,
				band,
				columns: snapshotDisplayedColumns(api),
			});
			saveGridSessionUserBandWidths(api, gridId, band);
		},
		[enabled, gridId, resolveBand],
	);

	useEffect(() => {
		if (!userWidthsSaveRef) return;
		userWidthsSaveRef.current = saveUserBandWidths;
	}, [userWidthsSaveRef, saveUserBandWidths]);

	const appliedRef = useRef(false);

	const applySavedState = useCallback(
		(api: GridApi) => {
			if (!enabled || appliedRef.current || initialState) return;
			const band = resolveBand();
			activeBandRef.current = band;
			const saved = readGridSessionState(gridId);
			if (!saved) return;
			applyGridSessionState(
				api,
				saved,
				band,
				columnVisibilityRef.current,
			);
			appliedRef.current = true;
		},
		[enabled, gridId, initialState, resolveBand],
	);

	const onColumnDefsChanged = useCallback(
		(api: GridApi | null) => {
			if (!api || !enabled) return;
			const band = resolveBand();
			activeBandRef.current = band;
			const saved = readGridSessionState(gridId);
			if (saved?.columnLayout) {
				applyGridSessionState(
					api,
					saved,
					band,
					columnVisibilityRef.current,
				);
			}
		},
		[enabled, gridId, resolveBand],
	);

	const onGridReady = useCallback(
		(event: GridReadyEvent) => {
			applySavedState(event.api);
		},
		[applySavedState],
	);

	const onFirstDataRendered = useCallback(
		(event: { api: GridApi }) => {
			if (!initialState) {
				applySavedState(event.api);
			} else {
				const band = resolveBand();
				activeBandRef.current = band;
			}
			runAdaptiveLayout(event.api);
		},
		[applySavedState, initialState, resolveBand, runAdaptiveLayout],
	);

	const onGridSizeChanged = useCallback(
		(event: { api: GridApi; clientWidth?: number; clientHeight?: number }) => {
			const layoutApi = adaptiveLayoutRef.current;
			const wrapEl = layoutApi?.wrapRef.current;
			const { skip, pane } = shouldSkipWrapOnlyGridSizeChange(
				lastPaneInnerRef,
				layoutApi?.shellRef.current,
				wrapEl,
			);
			gridLayoutLog('session.onGridSizeChanged', {
				gridId,
				clientWidth: event.clientWidth ?? null,
				clientHeight: event.clientHeight ?? null,
				pane,
				skip,
				band: activeBandRef.current,
				before: snapshotDisplayedColumns(event.api),
			});
			if (skip) return;
			queueMicrotask(() => {
				const bandChanged = syncBandColumnState(event.api);
				gridLayoutLog('session.onGridSizeChanged.microtask', {
					gridId,
					bandChanged,
					band: activeBandRef.current,
				});
				runAdaptiveLayout(event.api);
			});
		},
		[syncBandColumnState, runAdaptiveLayout, gridId],
	);

	const onSortChanged = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveGridSessionSharedLayout(event.api, gridId);
		},
		[enabled, gridId],
	);

	const onFilterChanged = useCallback(
		(event: { api: GridApi }) => {
			if (!enabled) return;
			saveGridSessionFilter(event.api, gridId);
		},
		[enabled, gridId],
	);

	const onColumnResized = useCallback(
		(event: ColumnResizedEvent) => {
			if (!enabled || !event.finished) return;
			const isUser = isUserColumnResizeEvent(event);
			gridLayoutLog('session.onColumnResized', {
				gridId,
				source: event.source,
				finished: event.finished,
				isUser,
				resized: event.columns?.map((col) => ({
					id: col.getColId(),
					w: col.getActualWidth(),
				})),
				columns: snapshotDisplayedColumns(event.api),
			});
			if (!isUser) {
				return;
			}
			saveUserBandWidths(event.api);
			applyLayoutAfterUserColumnResize(event.api);
		},
		[
			enabled,
			gridId,
			saveUserBandWidths,
			applyLayoutAfterUserColumnResize,
		],
	);

	return {
		initialState,
		onGridReady,
		onFirstDataRendered,
		onGridSizeChanged,
		onSortChanged,
		onFilterChanged,
		onColumnResized,
		onColumnDefsChanged,
	};
}

export const DEV_TESTS_COLUMN_OPTIONS: EntityColumnOption[] = [
	{ field: 'file', headerName: 'File', required: true },
	{ field: 'edgeCase', headerName: 'Description' },
	{ field: 'asserts', headerName: 'Checks' },
];

export const DEV_SCRIPTS_COLUMN_OPTIONS: EntityColumnOption[] = [
	{ field: 'name', headerName: 'Script', required: true },
	{ field: 'description', headerName: 'Description' },
	{ field: 'command', headerName: 'Command' },
];

export const DEV_TESTS_GRID_COLUMNS_STORAGE_KEY = 'field:devTestsGridColumns';
export const DEV_SCRIPTS_GRID_COLUMNS_STORAGE_KEY = 'field:devScriptsGridColumns';
