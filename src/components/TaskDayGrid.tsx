import { useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import type { GridApi, RowClickedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type { Task } from '../types/task';

type TaskDayGridProps = {
	tasks: Task[];
	columnDefs: ColDef<Task>[];
	defaultColDef: ColDef;
	isMobile: boolean | undefined;
	onRowClicked: (event: RowClickedEvent<Task>) => void;
	ptrEnabled: boolean;
	onBindViewport: (viewport: HTMLElement | null) => void;
};

export function TaskDayGrid({
	tasks,
	columnDefs,
	defaultColDef,
	isMobile,
	onRowClicked,
	ptrEnabled,
	onBindViewport,
}: TaskDayGridProps) {
	const gridApiRef = useRef<GridApi<Task> | null>(null);
	const gridWrapRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		queueMicrotask(() => gridApiRef.current?.sizeColumnsToFit());
	}, [columnDefs, tasks]);

	const bindGridViewport = () => {
		const viewport = gridWrapRef.current?.querySelector(
			'.ag-body-viewport',
		) as HTMLElement | null;
		onBindViewport(viewport);
	};

	return (
		<Box ref={gridWrapRef} className='tasks-grid-wrap ag-theme-quartz'>
			<AgGridProvider modules={[AllCommunityModule]}>
				<AgGridReact<Task>
					rowData={tasks}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					getRowId={(p) => String(p.data.id)}
					rowHeight={isMobile ? 40 : undefined}
					animateRows
					suppressCellFocus
					suppressHorizontalScroll
					rowStyle={{ cursor: 'pointer' }}
					onRowClicked={onRowClicked}
					onGridReady={(e) => {
						gridApiRef.current = e.api;
						if (ptrEnabled) bindGridViewport();
					}}
					onGridSizeChanged={(e) => e.api.sizeColumnsToFit()}
					onFirstDataRendered={(e) => {
						e.api.sizeColumnsToFit();
						if (ptrEnabled) bindGridViewport();
					}}
				/>
			</AgGridProvider>
		</Box>
	);
}
