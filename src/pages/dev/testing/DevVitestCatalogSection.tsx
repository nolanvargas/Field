import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert, Box, Button, Group, Loader, TextInput } from '@mantine/core';

import { useMediaQuery } from '@mantine/hooks';

import type { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';

import { AllCommunityModule } from 'ag-grid-community';

import { AgGridProvider, AgGridReact } from 'ag-grid-react';

import { RotateCcw } from 'lucide-react';

import { listDevTests, type DevTestCase } from '../../../api/devTests';

import {
	buildDevTestFileHref,
	devTestFileLabel,
	type DevTestLinksConfig,
} from '../../../devTestsFileLink';

import { AgGridLayoutControls } from '../../../components/AgGridLayoutControls';

import {
	AG_GRID_MOBILE_MQ,
	buildEntityGridColumnDefs,
	DEV_TESTS_COLUMN_OPTIONS,
	DEV_TESTS_GRID_COLUMNS_STORAGE_KEY,
	getDefaultColDef,
	useAdaptiveGridLayout,
	useBandedColumnWidthSaveBridge,
	useEntityGridColumnPicker,
	usePersistedAgGridSession,
} from '../../../agGridDefaults';
import { useGridForceFullWidth } from '../../../agGridLayoutPrefs';

function categoryLabelFromFile(file: string): string {
	return file
		.replace(/^tests\//, '')
		.replace(/\.test\.tsx?$/, '');
}

type DevVitestCatalogSectionProps = {
	onCountsChange?: (count: number) => void;
};

export function DevVitestCatalogSection({
	onCountsChange,
}: DevVitestCatalogSectionProps) {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const [tests, setTests] = useState<DevTestCase[]>([]);
	const [links, setLinks] = useState<DevTestLinksConfig | undefined>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [category, setCategory] = useState<string>('all');

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const [forceFullWidth, setForceFullWidth] = useGridForceFullWidth();
	const { userWidthsSaveRef, onUserColumnWidthsSettled } =
		useBandedColumnWidthSaveBridge();
	const adaptiveLayout = useAdaptiveGridLayout(!isMobile, {
		forceFullWidth,
		onUserColumnWidthsSettled,
	});

	const {
		visibleColumns,
		toggleColumn,
		builtinColumnOptions,
		customColumnOptions,
		columnVisibility,
	} = useEntityGridColumnPicker(
		DEV_TESTS_GRID_COLUMNS_STORAGE_KEY,
		DEV_TESTS_COLUMN_OPTIONS,
		[],
	);

	const gridSession = usePersistedAgGridSession(
		'dev-tests',
		!isMobile,
		adaptiveLayout,
		columnVisibility,
		userWidthsSaveRef,
	);

	const gridApiRef = useRef<GridApi | null>(null);

	useEffect(() => {
		const api = gridApiRef.current;
		if (!api || isMobile) return;
		adaptiveLayout.apply(api, {
			debugReason: `forceFullWidth-toggle:${forceFullWidth}`,
		});
	}, [forceFullWidth, isMobile, adaptiveLayout.apply]);

	useEffect(() => {
		gridSession.onColumnDefsChanged(gridApiRef.current);
	}, [visibleColumns, gridSession.onColumnDefsChanged]);

	const refreshTests = useCallback(
		async (refresh: boolean, signal?: AbortSignal) => {
			setLoading(true);
			setError(null);
			try {
				const next = await listDevTests({ refresh, signal });
				if (!signal?.aborted) {
					setTests(next.tests);
					setLinks(next.links);
					onCountsChange?.(next.tests.length);
				}
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				setError(err instanceof Error ? err.message : 'Failed to load tests');
			} finally {
				if (!signal?.aborted) setLoading(false);
			}
		},
		[onCountsChange],
	);

	useEffect(() => {
		const controller = new AbortController();
		void refreshTests(false, controller.signal);
		return () => controller.abort();
	}, [refreshTests]);

	const categories = useMemo(() => {
		const counts = new Map<string, number>();
		for (const test of tests) {
			counts.set(test.file, (counts.get(test.file) ?? 0) + 1);
		}
		return [...counts.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([file, count]) => ({
				file,
				label: categoryLabelFromFile(file),
				count,
			}));
	}, [tests]);

	const rowData = useMemo(() => {
		if (category === 'all') return tests;
		return tests.filter((test) => test.file === category);
	}, [tests, category]);

	const baseColumnDefs = useMemo<ColDef<DevTestCase>[]>(
		() => [
			{
				field: 'file',
				headerName: 'File',
				minWidth: 160,
				cellRenderer: (params: ICellRendererParams<DevTestCase>) => {
					const test = params.data;
					if (!test) return null;
					const label = devTestFileLabel(test.file, test.line);
					const href = buildDevTestFileHref(links, test.file, test.line);
					if (!href) return label;
					return (
						<a
							href={href}
							className='dev-tests-file-link'
							onClick={(event) => event.stopPropagation()}
						>
							{label}
						</a>
					);
				},
			},
			{
				field: 'edgeCase',
				headerName: 'Description',
				minWidth: 220,
				wrapText: true,
				autoHeight: true,
				tooltipField: 'edgeCase',
			},
			{
				field: 'asserts',
				headerName: 'Checks',
				minWidth: 160,
				wrapText: true,
				autoHeight: true,
				tooltipField: 'asserts',
			},
		],
		[links],
	);

	const columnDefs = useMemo(
		() =>
			buildEntityGridColumnDefs(
				baseColumnDefs,
				[],
				visibleColumns,
				DEV_TESTS_COLUMN_OPTIONS,
			),
		[baseColumnDefs, visibleColumns],
	);

	return (
		<>
			{error ? (
				<Alert color='red' title='Could not load tests' mb='md'>
					{error}
				</Alert>
			) : null}

			<Group justify='flex-end' mb='sm'>
				{!isMobile ? (
					<AgGridLayoutControls
						forceFullWidth={forceFullWidth}
						onToggleForceFullWidth={() => setForceFullWidth(!forceFullWidth)}
						columnOptions={{
							builtin: builtinColumnOptions,
							custom: customColumnOptions,
							visibleColumns,
							onToggleColumn: toggleColumn,
						}}
					/>
				) : null}
				<Button
					variant='light'
					leftSection={<RotateCcw size={14} />}
					onClick={() => void refreshTests(true)}
					loading={loading && tests.length > 0}
				>
					Refresh catalog
				</Button>
			</Group>

			{categories.length > 0 ? (
				<div
					className='dev-tests-categories'
					role='tablist'
					aria-label='Filter tests by file'
				>
					<button
						type='button'
						role='tab'
						aria-selected={category === 'all'}
						className='dev-tests-category-button'
						data-selected={category === 'all' || undefined}
						onClick={() => setCategory('all')}
					>
						All ({tests.length})
					</button>
					{categories.map((entry) => {
						const selected = category === entry.file;
						return (
							<button
								key={entry.file}
								type='button'
								role='tab'
								aria-selected={selected}
								className='dev-tests-category-button'
								data-selected={selected || undefined}
								onClick={() => setCategory(entry.file)}
							>
								{entry.label} ({entry.count})
							</button>
						);
					})}
				</div>
			) : null}

			<Box maw={400} mb='sm'>
				<TextInput
					placeholder='Filter tests'
					value={query}
					onChange={(event) => setQuery(event.currentTarget.value)}
				/>
			</Box>

			<Box ref={adaptiveLayout.shellRef} className='tasks-grid-shell'>
				<Box
					ref={adaptiveLayout.wrapRef}
					className='tasks-grid-wrap ag-theme-quartz'
					data-layout={adaptiveLayout.layoutMode}
				>
					{loading && tests.length === 0 ? (
						<Group justify='center' py='xl'>
							<Loader size='sm' />
						</Group>
					) : (
						<AgGridProvider modules={[AllCommunityModule]}>
							<AgGridReact<DevTestCase>
								rowData={rowData}
								columnDefs={columnDefs}
								defaultColDef={defaultColDef}
								initialState={gridSession.initialState}
								getRowId={(p) => p.data.id}
								quickFilterText={query}
								animateRows
								suppressCellFocus
								suppressHorizontalScroll
								onGridReady={(e) => {
									gridApiRef.current = e.api;
									gridSession.onGridReady(e);
								}}
								onGridSizeChanged={gridSession.onGridSizeChanged}
								onFirstDataRendered={gridSession.onFirstDataRendered}
								onSortChanged={gridSession.onSortChanged}
								onFilterChanged={gridSession.onFilterChanged}
								onColumnResized={gridSession.onColumnResized}
							/>
						</AgGridProvider>
					)}
				</Box>
			</Box>
		</>
	);
}
