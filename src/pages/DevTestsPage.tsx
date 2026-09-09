import { useCallback, useEffect, useMemo, useState } from 'react';

import { Navigate } from 'react-router-dom';

import { Alert, Box, Button, Group, Loader, TextInput } from '@mantine/core';

import { useMediaQuery } from '@mantine/hooks';

import type { ColDef, ICellRendererParams } from 'ag-grid-community';

import { AllCommunityModule } from 'ag-grid-community';

import { AgGridProvider, AgGridReact } from 'ag-grid-react';

import { RotateCcw } from 'lucide-react';

import { listDevTests, type DevTestCase } from '../api/devTests';

import {

	buildDevTestFileHref,

	devTestFileLabel,

	type DevTestLinksConfig,

} from '../devTestsFileLink';

import { PageHeader } from '../components/PageHeader';

import {

	AG_GRID_MOBILE_MQ,

	getDefaultColDef,

	usePersistedAgGridSession,

} from '../agGridDefaults';



function categoryLabelFromFile(file: string): string {

	return file

		.replace(/^tests\//, '')

		.replace(/\.test\.tsx?$/, '');

}



export function DevTestsPage() {

	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);

	const [tests, setTests] = useState<DevTestCase[]>([]);

	const [links, setLinks] = useState<DevTestLinksConfig | undefined>();

	const [loading, setLoading] = useState(true);

	const [error, setError] = useState<string | null>(null);

	const [query, setQuery] = useState('');

	const [category, setCategory] = useState<string>('all');



	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);

	const gridSession = usePersistedAgGridSession('dev-tests', !isMobile);



	const refreshTests = useCallback(

		async (refresh: boolean, signal?: AbortSignal) => {

			setLoading(true);

			setError(null);

			try {

				const next = await listDevTests({ refresh, signal });

				if (!signal?.aborted) {

					setTests(next.tests);

					setLinks(next.links);

				}

			} catch (err: unknown) {

				if (err instanceof DOMException && err.name === 'AbortError') return;

				setError(err instanceof Error ? err.message : 'Failed to load tests');

			} finally {

				if (!signal?.aborted) setLoading(false);

			}

		},

		[],

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



	const columnDefs = useMemo<ColDef<DevTestCase>[]>(

		() => [

			{

				field: 'file',

				headerName: 'File',

				minWidth: 160,

				maxWidth: 220,

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

				flex: 7,

				wrapText: true,

				autoHeight: true,

				tooltipField: 'edgeCase',

			},

			{

				field: 'asserts',

				headerName: 'Checks',

				minWidth: 160,

				flex: 3,

				wrapText: true,

				autoHeight: true,

				tooltipField: 'asserts',

			},

		],

		[links],

	);



	if (!import.meta.env.DEV) {

		return <Navigate to='/' replace />;

	}



	return (

		<Box className='tasks-page'>

			<PageHeader

				title={loading && tests.length === 0 ? 'Tests' : `Tests (${tests.length})`}

				right={

					<Button

						variant='light'

						leftSection={<RotateCcw size={14} />}

						onClick={() => void refreshTests(true)}

						loading={loading && tests.length > 0}

					>

						Refresh

					</Button>

				}

			/>



			{error ? (

				<Alert color='red' title='Could not load tests' mb='md'>

					{error}

				</Alert>

			) : null}



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



			<Box className='tasks-grid-wrap ag-theme-quartz'>

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

							getRowId={(p) => p.data.id}

							quickFilterText={query}

							animateRows

							suppressCellFocus

							suppressHorizontalScroll

							onGridReady={gridSession.onGridReady}

							onGridSizeChanged={gridSession.onGridSizeChanged}

							onFirstDataRendered={gridSession.onFirstDataRendered}

							onSortChanged={gridSession.onSortChanged}

							onFilterChanged={gridSession.onFilterChanged}

						/>

					</AgGridProvider>

				)}

			</Box>

		</Box>

	);

}


