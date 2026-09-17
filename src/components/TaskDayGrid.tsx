import { useEffect, useRef } from 'react';

import { Box } from '@mantine/core';

import type { GridApi, RowClickedEvent } from 'ag-grid-community';

import { AllCommunityModule } from 'ag-grid-community';

import { AgGridProvider, AgGridReact } from 'ag-grid-react';

import type { ColDef } from 'ag-grid-community';

import {

	type AdaptiveGridLayout,

	type usePersistedTaskGridColumns,

} from '../agGridDefaults';

import type { Task } from '../types/task';



type TaskGridSession = ReturnType<typeof usePersistedTaskGridColumns>;



type TaskDayGridProps = {

	tasks: Task[];

	columnDefs: ColDef<Task>[];

	defaultColDef: ColDef;

	loading?: boolean;

	onRowClicked: (event: RowClickedEvent<Task>) => void;

	ptrEnabled: boolean;

	onBindViewport: (viewport: HTMLElement | null) => void;

	/** Desktop list view — local column layout persistence. */

	gridSession?: TaskGridSession;

	adaptiveLayout?: AdaptiveGridLayout;

	onBindGridApi?: (api: GridApi<Task> | null) => void;

};



export function TaskDayGrid({

	tasks,

	columnDefs,

	defaultColDef,

	loading = false,

	onRowClicked,

	ptrEnabled,

	onBindViewport,

	gridSession,

	adaptiveLayout,

	onBindGridApi,

}: TaskDayGridProps) {

	const gridApiRef = useRef<GridApi<Task> | null>(null);

	const gridWrapRef = useRef<HTMLDivElement | null>(null);

	const initialState = gridSession?.initialState;

	const wrapRef = adaptiveLayout?.wrapRef ?? gridWrapRef;

	const shellRef = adaptiveLayout?.shellRef;

	const onColumnDefsChanged = gridSession?.onColumnDefsChanged;

	const applyAdaptive = adaptiveLayout?.apply;



	useEffect(() => {

		if (onColumnDefsChanged) {

			onColumnDefsChanged(gridApiRef.current);

			return;

		}

		queueMicrotask(() => {

			const api = gridApiRef.current;

			if (!api) return;

			if (applyAdaptive) {

				applyAdaptive(api, {
					debugReason: 'taskDayGrid.columnDefs',
				});

			} else {

				api.sizeColumnsToFit();

			}

		});

	}, [columnDefs, onColumnDefsChanged, applyAdaptive]);



	useEffect(() => {

		if (onColumnDefsChanged) return;

		queueMicrotask(() => {

			const api = gridApiRef.current;

			if (!api) return;

			if (applyAdaptive) {

				applyAdaptive(api, {
					debugReason: 'taskDayGrid.tasks',
				});

			} else {

				api.sizeColumnsToFit();

			}

		});

	}, [tasks, onColumnDefsChanged, applyAdaptive]);



	const bindGridViewport = () => {

		const viewport = wrapRef.current?.querySelector(

			'.ag-body-viewport',

		) as HTMLElement | null;

		onBindViewport(viewport);

	};



	const grid = (

		<AgGridProvider modules={[AllCommunityModule]}>

			<AgGridReact<Task>

				rowData={tasks}

				columnDefs={columnDefs}

				defaultColDef={defaultColDef}

				initialState={initialState}

				loading={loading}

				suppressNoRowsOverlay={loading}

				getRowId={(p) => String(p.data.id)}

				animateRows

				suppressCellFocus

				suppressHorizontalScroll

				rowStyle={{ cursor: 'pointer' }}

				onRowClicked={onRowClicked}

				onGridReady={(e) => {

					gridApiRef.current = e.api;

					onBindGridApi?.(e.api);

					gridSession?.onGridReady(e);

					if (ptrEnabled) bindGridViewport();

				}}

				onGridSizeChanged={(e) => {

					if (gridSession?.onGridSizeChanged) {

						gridSession.onGridSizeChanged(e);

					} else if (adaptiveLayout) {

						queueMicrotask(() => {

							adaptiveLayout.apply(e.api, { skipAutoSize: true });

						});

					} else {

						e.api.sizeColumnsToFit();

					}

				}}

				onFirstDataRendered={(e) => {

					gridSession?.onFirstDataRendered(e);

					if (!gridSession) {

						if (adaptiveLayout) {

							adaptiveLayout.apply(e.api);

						} else {

							e.api.sizeColumnsToFit();

						}

					}

					if (ptrEnabled) bindGridViewport();

				}}

				onColumnResized={gridSession?.onColumnResized}

				onColumnMoved={gridSession?.onColumnMoved}

				onSortChanged={gridSession?.onSortChanged}

			/>

		</AgGridProvider>

	);



	const wrap = (

		<Box

			ref={wrapRef}

			className='tasks-grid-wrap ag-theme-quartz'

			data-layout={adaptiveLayout?.layoutMode ?? 'full'}

		>

			{grid}

		</Box>

	);



	if (shellRef) {

		return (

			<Box ref={shellRef} className='tasks-grid-shell'>

				{wrap}

			</Box>

		);

	}



	return wrap;

}


