import { describe, expect, it, vi } from 'vitest';
import type { GridApi } from 'ag-grid-community';
import {
	applyAdaptiveGridLayout,
	buildPartialInitialStateFromColumnState,
	columnSumAfterWidthUpdates,
	columnWidthsFromHeaderWheel,
	customFieldColumnId,
	getDefaultColDef,
	getTaskColumnDefs,
	getTaskColumnOptions,
	getMobileTaskCardBuiltinColumnOptions,
	headerCellColIdFromEvent,
	isGridHeaderWheelEvent,
	buildEntityGridColumnDefs,
	CONTACT_COLUMN_OPTIONS,
	contactColumnDefs,
	mergeGridColumnVisibility,
	mergeTaskGridColumnState,
	parseCustomFieldColumnId,
	sanitizeVisibleTaskColumns,
	taskColumnHiddenByPrefs,
	wheelDeltaToWidthPx,
} from '../src/agGridDefaults';

function layoutFixture(paneWidth: number, wrapChrome = 0) {
	const pane = document.createElement('div');
	Object.defineProperty(pane, 'clientWidth', {
		value: paneWidth,
		configurable: true,
	});
	const shell = document.createElement('div');
	Object.defineProperty(shell, 'clientWidth', {
		value: paneWidth,
		configurable: true,
	});
	pane.appendChild(shell);
	const wrap = document.createElement('div');
	Object.defineProperty(wrap, 'offsetWidth', {
		value: paneWidth,
		configurable: true,
	});
	Object.defineProperty(wrap, 'clientWidth', {
		value: paneWidth - wrapChrome,
		configurable: true,
	});
	return { pane, shell, wrap };
}

describe('applyAdaptiveGridLayout forceFullWidth', () => {
	it('always uses full layout', () => {
		const { shell, wrap } = layoutFixture(800);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [{ getActualWidth: () => 100 }],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap, {
			forceFullWidth: true,
		});

		expect(result.mode).toBe('full');
		expect(result.compactWidth).toBeNull();
		expect(wrap.dataset.layout).toBe('full');
		expect(api.sizeColumnsToFit).toHaveBeenCalled();
		expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
	});

	it('keeps column widths when skipAutoSize is set (header wheel)', () => {
		const { shell, wrap } = layoutFixture(800);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [{ getActualWidth: () => 100 }],
		} as unknown as GridApi;

		applyAdaptiveGridLayout(api, shell, wrap, {
			forceFullWidth: true,
			skipAutoSize: true,
		});

		expect(wrap.dataset.layout).toBe('full');
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
	});
});

describe('applyAdaptiveGridLayout default', () => {
	it('shrink-wraps to column content when it fits the pane', () => {
		const { shell, wrap } = layoutFixture(800);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [{ getActualWidth: () => 100 }],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap);

		expect(result.mode).toBe('compact');
		expect(result.compactWidth).toBe(100);
		expect(wrap.dataset.layout).toBe('compact');
		expect(wrap.style.width).toBe('100px');
		expect(wrap.style.height).toBe('');
		expect(api.autoSizeAllColumns).toHaveBeenCalled();
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
	});

	it('fills the pane when autosized columns overflow', () => {
		const { shell, wrap } = layoutFixture(400);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 240 },
				{ getActualWidth: () => 240 },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap);

		expect(result.mode).toBe('full');
		expect(api.autoSizeAllColumns).toHaveBeenCalled();
		expect(api.sizeColumnsToFit).toHaveBeenCalled();
	});

	it('shrink-wraps when columns exactly fill the pane', () => {
		const { shell, wrap } = layoutFixture(400);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 200 },
				{ getActualWidth: () => 200 },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap);

		expect(result.mode).toBe('compact');
		expect(result.compactWidth).toBe(400);
		expect(wrap.dataset.layout).toBe('compact');
		expect(api.autoSizeAllColumns).toHaveBeenCalled();
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
	});
});

describe('applyAdaptiveGridLayout skipAutoSize', () => {
	it('wraps to saved column widths when they fit', () => {
		const { shell, wrap } = layoutFixture(800, 2);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 120 },
				{ getActualWidth: () => 160 },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap, {
			skipAutoSize: true,
		});

		expect(result.mode).toBe('compact');
		expect(result.compactWidth).toBe(282);
		expect(wrap.dataset.layout).toBe('compact');
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
		expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
	});

	it('keeps user widths when they overflow the pane', () => {
		const { shell, wrap } = layoutFixture(400, 2);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 240, getColId: () => 'a' },
				{ getActualWidth: () => 240, getColId: () => 'b' },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap, {
			skipAutoSize: true,
			savedBandContentWidth: 480,
		});

		expect(result.mode).toBe('full');
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
		expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
	});

	it('wraps when saved widths exactly fill the pane', () => {
		const { shell, wrap } = layoutFixture(400, 2);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 199, getColId: () => 'a' },
				{ getActualWidth: () => 199, getColId: () => 'b' },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap, {
			skipAutoSize: true,
			savedBandContentWidth: 398,
		});

		expect(result.mode).toBe('compact');
		expect(result.compactWidth).toBe(400);
		expect(wrap.dataset.layout).toBe('compact');
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
		expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
	});

	it('stays full when saved band widths overflow but columns were pane-fitted', () => {
		const { shell, wrap } = layoutFixture(400, 2);
		const api = {
			autoSizeAllColumns: vi.fn(),
			sizeColumnsToFit: vi.fn(),
			getAllDisplayedColumns: () => [
				{ getActualWidth: () => 199, getColId: () => 'a' },
				{ getActualWidth: () => 199, getColId: () => 'b' },
			],
		} as unknown as GridApi;

		const result = applyAdaptiveGridLayout(api, shell, wrap, {
			skipAutoSize: true,
			savedBandContentWidth: 480,
		});

		expect(result.mode).toBe('full');
		expect(wrap.dataset.layout).toBe('full');
		expect(api.sizeColumnsToFit).not.toHaveBeenCalled();
	});
});

describe('mobile task card column settings', () => {
	it('uses a single Window toggle instead of Start and End', () => {
		const options = getMobileTaskCardBuiltinColumnOptions();
		const fields = options.map((o) => o.field);
		const window = options.find((o) => o.field === 'windowStartAt');
		expect(fields).not.toContain('externalKey');
		expect(fields).not.toContain('taskType');
		expect(fields).not.toContain('status');
		expect(fields).not.toContain('windowEndAt');
		expect(fields).toContain('windowStartAt');
		expect(window?.headerName).toBe('Window');
	});
});

describe('task grid custom field columns', () => {
	it('builds column options from org custom field defs', () => {
		const options = getTaskColumnOptions('Job #', [
			{
				slot: 2,
				label: 'Lift gate',
				dataType: 'boolean',
				required: false,
				lookupTable: null,
				options: [],
			},
		]);
		expect(options.some((o) => o.field === 'cf:2' && o.headerName === 'Lift gate')).toBe(
			true,
		);
	});

	it('includes hidden custom field column defs when selected', () => {
		const defs = getTaskColumnDefs(['externalKey', customFieldColumnId(1)], {
			customFieldDefs: [
				{
					slot: 1,
					label: 'PO number',
					dataType: 'text',
					required: false,
					lookupTable: null,
					options: [],
				},
			],
		});
		const customCol = defs.find((col) => col.colId === 'cf:1');
		expect(customCol?.hide).toBe(false);
		expect(customCol?.headerName).toBe('PO number');
	});

	it('does not set min or max width on task columns', () => {
		const defs = getTaskColumnDefs(['externalKey', customFieldColumnId(1)], {
			showCancelledTtl: true,
			customFieldDefs: [
				{
					slot: 1,
					label: 'PO number',
					dataType: 'text',
					required: false,
					lookupTable: null,
					options: [],
				},
			],
		});
		expect(defs.length).toBeGreaterThan(0);
		for (const col of defs) {
			expect(col.minWidth).toBeUndefined();
			expect(col.maxWidth).toBeUndefined();
		}
	});

	it('parses and sanitizes stored custom field column ids', () => {
		expect(parseCustomFieldColumnId('cf:3')).toBe(3);
		expect(parseCustomFieldColumnId('externalKey')).toBeNull();
		const sanitized = sanitizeVisibleTaskColumns(
			['externalKey', 'cf:1', 'cf:9'],
			[
				{
					slot: 1,
					label: 'PO',
					dataType: 'text',
					required: false,
					lookupTable: null,
					options: [],
				},
			],
		);
		expect(sanitized).toEqual(['externalKey', 'cf:1']);
	});
});

describe('entity grid column visibility', () => {
	it('hides columns not in visible prefs', () => {
		const cols = buildEntityGridColumnDefs(
			contactColumnDefs,
			[],
			['name', 'email'],
			CONTACT_COLUMN_OPTIONS,
		);
		const byField = (field: string) =>
			cols.find((c) => c.field === field || c.colId === field);
		expect(byField('name')?.hide).toBe(false);
		expect(byField('email')?.hide).toBe(false);
		expect(byField('phone')?.hide).toBe(true);
	});

	it('merges session column state with visibility prefs', () => {
		const merged = mergeGridColumnVisibility(
			[
				{ colId: 'name', width: 120, hide: false },
				{ colId: 'phone', width: 90, hide: false },
				{ colId: 'actions', width: 300, hide: false },
			],
			{
				visibleFields: ['name'],
				pinnedColIds: ['actions'],
				isTogglableColumn: (id) => id === 'name' || id === 'phone',
			},
		);
		expect(merged).toEqual([
			{ colId: 'name', width: 120, hide: false },
			{ colId: 'phone', width: 90, hide: true },
			{ colId: 'actions', width: 300, hide: false },
		]);
	});
});

describe('task grid column state', () => {
	it('builds initialState from saved column layout', () => {
		const initialState = buildPartialInitialStateFromColumnState([
			{ colId: 'externalKey', width: 120, hide: false, sort: 'asc' },
			{ colId: 'status', width: 90, hide: true },
		]);
		expect(initialState.partialColumnState).toBe(true);
		expect(initialState.columnSizing?.columnSizingModel).toEqual([
			{ colId: 'externalKey', width: 120 },
			{ colId: 'status', width: 90 },
		]);
		expect(initialState.columnVisibility?.hiddenColIds).toEqual(['status']);
		expect(initialState.sort?.sortModel).toEqual([
			{ colId: 'externalKey', sort: 'asc' },
		]);
	});

	it('derives hide from visible column prefs', () => {
		const visible = new Set(['externalKey', 'jobTitle'] as const);
		expect(
			taskColumnHiddenByPrefs('externalKey', visible, false),
		).toBe(false);
		expect(taskColumnHiddenByPrefs('status', visible, false)).toBe(true);
		expect(taskColumnHiddenByPrefs('ttl', visible, true)).toBe(false);
		expect(taskColumnHiddenByPrefs('ttl', visible, false)).toBe(true);
		expect(
			taskColumnHiddenByPrefs('cf:2', new Set([customFieldColumnId(2)]), false),
		).toBe(false);
	});

	it('merges saved widths with current visibility prefs', () => {
		const merged = mergeTaskGridColumnState(
			[
				{ colId: 'externalKey', width: 120, hide: false },
				{ colId: 'status', width: 90, hide: false },
			],
			['externalKey'],
			false,
		);
		expect(merged).toEqual([
			{ colId: 'externalKey', width: 120, hide: false },
			{ colId: 'status', width: 90, hide: true },
		]);
	});
});

describe('getDefaultColDef resize handles', () => {
	it('disables native edge resize on desktop and keeps it on mobile', () => {
		expect(getDefaultColDef(false).resizable).toBe(false);
		expect(getDefaultColDef(true).resizable).toBe(true);
	});
});

describe('wheelDeltaToWidthPx', () => {
	it('maps scroll up to a positive width delta and caps mouse-wheel ticks', () => {
		expect(
			wheelDeltaToWidthPx({ deltaY: -20, deltaX: 0, deltaMode: 0 }),
		).toBe(20);
		expect(
			wheelDeltaToWidthPx({ deltaY: 100, deltaX: 0, deltaMode: 0 }),
		).toBe(-40);
	});
});

describe('columnWidthsFromHeaderWheel', () => {
	const two = [
		{ colId: 'a', width: 120, minWidth: 72, maxWidth: 240 },
		{ colId: 'b', width: 160, minWidth: 72, maxWidth: 240 },
	];
	const three = [
		{ colId: 'a', width: 120, minWidth: 72, maxWidth: 240 },
		{ colId: 'b', width: 120, minWidth: 72, maxWidth: 240 },
		{ colId: 'c', width: 120, minWidth: 72, maxWidth: 240 },
	];

	it('with two columns, the other column absorbs the full opposite delta', () => {
		expect(columnWidthsFromHeaderWheel(two, 'a', 20)).toEqual([
			{ key: 'a', newWidth: 140 },
			{ key: 'b', newWidth: 140 },
		]);
	});

	it('widens the hovered column when it is last in the row', () => {
		expect(columnWidthsFromHeaderWheel(two, 'b', 20)).toEqual([
			{ key: 'a', newWidth: 100 },
			{ key: 'b', newWidth: 180 },
		]);
	});

	it('splits the opposite delta equally across every other column', () => {
		expect(columnWidthsFromHeaderWheel(three, 'a', 30)).toEqual([
			{ key: 'a', newWidth: 150 },
			{ key: 'b', newWidth: 105 },
			{ key: 'c', newWidth: 105 },
		]);
	});

	it('stops at min/max instead of overflowing other columns', () => {
		expect(columnWidthsFromHeaderWheel(two, 'a', 200)).toEqual([
			{ key: 'a', newWidth: 208 },
			{ key: 'b', newWidth: 72 },
		]);
	});

	it('in compact mode, only the hovered column changes so the table can grow', () => {
		expect(
			columnWidthsFromHeaderWheel(two, 'a', 20, { conserveTotal: false }),
		).toEqual([{ key: 'a', newWidth: 140 }]);
	});

	it('in compact mode, clamps the hovered column without touching others', () => {
		expect(
			columnWidthsFromHeaderWheel(two, 'a', 200, { conserveTotal: false }),
		).toEqual([{ key: 'a', newWidth: 240 }]);
	});
});

describe('columnSumAfterWidthUpdates', () => {
	it('replaces only updated columns in the total', () => {
		expect(
			columnSumAfterWidthUpdates(
				[
					{ colId: 'a', width: 120 },
					{ colId: 'b', width: 160 },
				],
				[{ key: 'a', newWidth: 140 }],
			),
		).toBe(300);
	});
});

describe('isGridHeaderWheelEvent', () => {
	it('is true anywhere on the header row, including outside a column cell', () => {
		const wrap = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'ag-header';
		const gutter = document.createElement('div');
		header.appendChild(gutter);
		wrap.appendChild(header);
		const event = { target: gutter } as unknown as Event;
		expect(isGridHeaderWheelEvent(event, wrap)).toBe(true);
	});

	it('ignores wheel over filter menus', () => {
		const wrap = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'ag-header';
		const menu = document.createElement('div');
		menu.className = 'ag-menu';
		header.appendChild(menu);
		wrap.appendChild(header);
		const event = { target: menu } as unknown as Event;
		expect(isGridHeaderWheelEvent(event, wrap)).toBe(false);
	});
});

describe('headerCellColIdFromEvent', () => {
	it('reads col-id from a header cell inside the wrap', () => {
		const wrap = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'ag-header-cell';
		header.setAttribute('col-id', 'jobTitle');
		const label = document.createElement('span');
		header.appendChild(label);
		wrap.appendChild(header);
		const event = { target: label } as unknown as Event;
		expect(headerCellColIdFromEvent(event, wrap)).toBe('jobTitle');
	});

	it('ignores wheel over filter menus', () => {
		const wrap = document.createElement('div');
		const header = document.createElement('div');
		header.className = 'ag-header-cell';
		header.setAttribute('col-id', 'jobTitle');
		const menu = document.createElement('div');
		menu.className = 'ag-menu';
		header.appendChild(menu);
		wrap.appendChild(header);
		const event = { target: menu } as unknown as Event;
		expect(headerCellColIdFromEvent(event, wrap)).toBeNull();
	});
});
