import type { ColumnResizedEvent, ColumnState } from 'ag-grid-community';

export type GridWidthBand = 'narrow' | 'medium' | 'wide';

/** Pane inner width ≤ this → narrow band. */
export const GRID_BAND_NARROW_MAX_PX = 1280;
/** Pane inner width ≥ this → wide band (medium is between). */
export const GRID_BAND_WIDE_MIN_PX = 2000;

/** Rough nav + padding subtracted from `window.innerWidth` before first grid measure. */
export const GRID_PANE_WIDTH_CHROME_ESTIMATE_PX = 280;

export type ColumnWidthMap = Record<string, number>;

export type ColumnSortEntry = {
	colId: string;
	sort?: 'asc' | 'desc' | null;
	sortIndex?: number | null;
};

export type BandedGridColumnLayoutV2 = {
	v: 2;
	order: string[];
	sort: ColumnSortEntry[];
	widthsByBand: Partial<Record<GridWidthBand, ColumnWidthMap>>;
};

const USER_COLUMN_RESIZE_SOURCES = new Set([
	'uiColumnResized',
	'uiColumnDragged',
]);

export function gridWidthBandFromPaneWidth(paneWidthPx: number): GridWidthBand {
	if (paneWidthPx <= GRID_BAND_NARROW_MAX_PX) return 'narrow';
	if (paneWidthPx < GRID_BAND_WIDE_MIN_PX) return 'medium';
	return 'wide';
}

export function estimatePaneWidthFromWindow(): number {
	if (typeof window === 'undefined') return GRID_BAND_WIDE_MIN_PX;
	return Math.max(0, window.innerWidth - GRID_PANE_WIDTH_CHROME_ESTIMATE_PX);
}

export function isUserColumnResizeEvent(event: ColumnResizedEvent): boolean {
	return USER_COLUMN_RESIZE_SOURCES.has(event.source);
}

export function sharedLayoutFromColumnState(
	state: ColumnState[],
): Pick<BandedGridColumnLayoutV2, 'order' | 'sort'> {
	const order = state
		.map((col) => col.colId)
		.filter((id): id is string => typeof id === 'string' && id.length > 0);
	const sort: ColumnSortEntry[] = [];
	for (const col of state) {
		if (!col.colId || col.sort == null) continue;
		sort.push({
			colId: col.colId,
			sort: col.sort,
			sortIndex: col.sortIndex ?? null,
		});
	}
	return { order, sort };
}

export function widthsFromColumnState(state: ColumnState[]): ColumnWidthMap {
	const widths: ColumnWidthMap = {};
	for (const col of state) {
		if (!col.colId || col.width == null || !Number.isFinite(col.width)) continue;
		widths[col.colId] = col.width;
	}
	return widths;
}

export function migrateLegacyColumnStateToV2(
	legacy: ColumnState[],
): BandedGridColumnLayoutV2 {
	const { order, sort } = sharedLayoutFromColumnState(legacy);
	return {
		v: 2,
		order,
		sort,
		widthsByBand: {
			wide: widthsFromColumnState(legacy),
		},
	};
}

export function parseBandedGridColumnLayout(
	parsed: unknown,
): BandedGridColumnLayoutV2 | null {
	if (Array.isArray(parsed)) {
		if (parsed.length === 0) return null;
		return migrateLegacyColumnStateToV2(parsed as ColumnState[]);
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const record = parsed as Record<string, unknown>;
	if (record.v !== 2) return null;
	if (!Array.isArray(record.order)) return null;
	const order = record.order.filter((id): id is string => typeof id === 'string');
	if (order.length === 0) return null;
	const sort: ColumnSortEntry[] = [];
	if (Array.isArray(record.sort)) {
		for (const entry of record.sort) {
			if (!entry || typeof entry !== 'object') continue;
			const colId = (entry as ColumnSortEntry).colId;
			if (typeof colId !== 'string' || !colId) continue;
			sort.push({
				colId,
				sort: (entry as ColumnSortEntry).sort ?? null,
				sortIndex: (entry as ColumnSortEntry).sortIndex ?? null,
			});
		}
	}
	const widthsByBand: Partial<Record<GridWidthBand, ColumnWidthMap>> = {};
	const rawBands = record.widthsByBand;
	if (rawBands && typeof rawBands === 'object') {
		for (const band of ['narrow', 'medium', 'wide'] as const) {
			const raw = (rawBands as Record<string, unknown>)[band];
			if (!raw || typeof raw !== 'object') continue;
			const map: ColumnWidthMap = {};
			for (const [colId, width] of Object.entries(raw)) {
				if (typeof width === 'number' && Number.isFinite(width)) {
					map[colId] = width;
				}
			}
			if (Object.keys(map).length > 0) widthsByBand[band] = map;
		}
	}
	return { v: 2, order, sort, widthsByBand };
}

export function buildColumnStateForBand(
	layout: BandedGridColumnLayoutV2,
	band: GridWidthBand,
): ColumnState[] {
	const bandWidths = layout.widthsByBand[band];
	const sortByCol = new Map(layout.sort.map((s) => [s.colId, s]));
	return layout.order.map((colId) => {
		const entry: ColumnState = { colId };
		const width = bandWidths?.[colId];
		if (width != null) entry.width = width;
		const sortEntry = sortByCol.get(colId);
		if (sortEntry?.sort != null) {
			entry.sort = sortEntry.sort;
			if (sortEntry.sortIndex != null) entry.sortIndex = sortEntry.sortIndex;
		}
		return entry;
	});
}

export function bandHasSavedWidths(
	layout: BandedGridColumnLayoutV2,
	band: GridWidthBand,
): boolean {
	const widths = layout.widthsByBand[band];
	return widths != null && Object.keys(widths).length > 0;
}

export function updateSharedLayoutFromApi(
	layout: BandedGridColumnLayoutV2,
	columnState: ColumnState[],
): BandedGridColumnLayoutV2 {
	const { order, sort } = sharedLayoutFromColumnState(columnState);
	return { ...layout, order, sort };
}

export function updateBandWidthsFromApi(
	layout: BandedGridColumnLayoutV2,
	band: GridWidthBand,
	columnState: ColumnState[],
): BandedGridColumnLayoutV2 {
	return {
		...layout,
		widthsByBand: {
			...layout.widthsByBand,
			[band]: widthsFromColumnState(columnState),
		},
	};
}

export function emptyBandedGridColumnLayout(
	columnState: ColumnState[],
): BandedGridColumnLayoutV2 {
	const { order, sort } = sharedLayoutFromColumnState(columnState);
	return { v: 2, order, sort, widthsByBand: {} };
}
