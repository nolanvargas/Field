import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Group, Loader, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Plus } from 'lucide-react';
import type { GridApi, RowClickedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { AgGridProvider, AgGridReact } from 'ag-grid-react';
import { listAddresses, type Address } from '../api/addresses';
import {
	AddressCatalogModals,
	type AddressCatalogModalsHandle,
} from '../components/AddressCatalogModals';
import { PageHeader } from '../components/PageHeader';
import { AgGridLayoutControls } from '../components/AgGridLayoutControls';
import {
	ADDRESS_COLUMN_OPTIONS,
	ADDRESS_GRID_COLUMNS_STORAGE_KEY,
	AG_GRID_MOBILE_MQ,
	addressColumnDefs,
	buildEntityGridColumnDefs,
	getDefaultColDef,
	useAdaptiveGridLayout,
	useBandedColumnWidthSaveBridge,
	useEntityGridColumnPicker,
	usePersistedAgGridSession,
} from '../agGridDefaults';
import { useGridForceFullWidth } from '../agGridLayoutPrefs';
import { useEntityCustomFieldDefs } from '../components/CustomFieldControl';
import { notifyError } from '../notify';

export function AddressesPage() {
	const isMobile = useMediaQuery(AG_GRID_MOBILE_MQ);
	const catalogModalsRef = useRef<AddressCatalogModalsHandle>(null);
	const [addresses, setAddresses] = useState<Address[]>([]);
	const [loading, setLoading] = useState(true);

	const defaultColDef = useMemo(() => getDefaultColDef(isMobile), [isMobile]);
	const [forceFullWidth, setForceFullWidth] = useGridForceFullWidth();
	const { userWidthsSaveRef, onUserColumnWidthsSettled } =
		useBandedColumnWidthSaveBridge();
	const adaptiveLayout = useAdaptiveGridLayout(!isMobile, {
		forceFullWidth,
		onUserColumnWidthsSettled,
	});
	const customFieldDefs = useEntityCustomFieldDefs('address');
	const {
		visibleColumns,
		toggleColumn,
		builtinColumnOptions,
		customColumnOptions,
		columnVisibility,
	} = useEntityGridColumnPicker(
		ADDRESS_GRID_COLUMNS_STORAGE_KEY,
		ADDRESS_COLUMN_OPTIONS,
		customFieldDefs,
	);
	const gridSession = usePersistedAgGridSession(
		'addresses',
		!isMobile,
		adaptiveLayout,
		columnVisibility,
		userWidthsSaveRef,
	);
	const columnDefs = useMemo(
		() =>
			buildEntityGridColumnDefs(
				addressColumnDefs,
				customFieldDefs,
				visibleColumns,
				ADDRESS_COLUMN_OPTIONS,
			),
		[customFieldDefs, visibleColumns],
	);

	const refreshAddresses = useCallback(async (signal?: AbortSignal) => {
		setLoading(true);
		try {
			const next = await listAddresses(signal);
			if (!signal?.aborted) setAddresses(next);
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			notifyError(
				err instanceof Error ? err.message : 'Failed to load addresses',
			);
		} finally {
			if (!signal?.aborted) setLoading(false);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void refreshAddresses(controller.signal);
		return () => controller.abort();
	}, [refreshAddresses]);

	const handleRowClicked = (event: RowClickedEvent<Address>) => {
		if (event.data?.id != null) {
			catalogModalsRef.current?.openDetail(event.data.id);
		}
	};

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

	return (
		<Box className='tasks-page'>
			<PageHeader
				title='Addresses'
				right={
					<>
						<Button
							leftSection={<Plus size={18} />}
							onClick={() => catalogModalsRef.current?.openCreate()}
							color='brand'
						>
							New Address
						</Button>
						{!isMobile ? (
							<AgGridLayoutControls
								forceFullWidth={forceFullWidth}
								onToggleForceFullWidth={() =>
									setForceFullWidth(!forceFullWidth)
								}
								columnOptions={{
									builtin: builtinColumnOptions,
									custom: customColumnOptions,
									visibleColumns,
									onToggleColumn: toggleColumn,
								}}
							/>
						) : null}
					</>
				}
			/>

			<Box ref={adaptiveLayout.shellRef} className='tasks-grid-shell'>
				<Box
					ref={adaptiveLayout.wrapRef}
					className='tasks-grid-wrap ag-theme-quartz'
					data-layout={adaptiveLayout.layoutMode}
				>
				{loading && addresses.length === 0 ? (
					<Group justify='center' py='xl'>
						<Loader size='sm' />
					</Group>
				) : (
					<AgGridProvider modules={[AllCommunityModule]}>
						<AgGridReact<Address>
							rowData={addresses}
							columnDefs={columnDefs}
							defaultColDef={defaultColDef}
							initialState={gridSession.initialState}
							getRowId={(p) => String(p.data.id)}
							animateRows
							suppressCellFocus
							suppressHorizontalScroll
							rowStyle={{ cursor: 'pointer' }}
							onRowClicked={handleRowClicked}
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

			<AddressCatalogModals
				ref={catalogModalsRef}
				allowDelete
				onMutated={refreshAddresses}
			/>
		</Box>
	);
}
